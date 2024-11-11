const fs = require('fs');
const { parse } = require('csv-parse');
const { createObjectCsvWriter } = require('csv-writer');
const fetch = require('node-fetch');

// Rate limiter configuration
const RATE_LIMIT = 400;  
const TIME_WINDOW = 100; // seconds
const BATCH_SIZE = 30;   
const DELAY_BETWEEN_BATCHES = (TIME_WINDOW * 1000) / (RATE_LIMIT / BATCH_SIZE); // ≈ 1000ms

// Sleep function
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Replace with your actual API key from Google Cloud Console
const API_KEY = 'AIzaSyCwmPrKvWqQQq5_x-GUzVZAWKdzA_o-AJc';

async function analyzeUrl(url) {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }

    let data;
    try {
        const response = await fetch(
            `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?strategy=mobile&url=${encodeURIComponent(url)}&key=${API_KEY}`
        );
        data = await response.json();
    } catch (error) {
        console.error(`Error fetching ${url}:`, error);
        return getErrorObject(url);
    }

    const result = {
        url: url,
        lighthouse_lcp: 'N/A',
        lighthouse_fcp: 'N/A',
        lighthouse_cls: 'N/A',
        lighthouse_performance_score: 'N/A',
        homepage_overall_category: 'N/A',
        origin_overall_category: 'N/A'
    };

    // Lighthouse metrics
    try {
        result.lighthouse_lcp = data.lighthouseResult.audits['largest-contentful-paint'].numericValue;
        result.lighthouse_fcp = data.lighthouseResult.audits['first-contentful-paint'].numericValue;
        result.lighthouse_cls = data.lighthouseResult.audits['cumulative-layout-shift'].numericValue;
        result.lighthouse_performance_score = data.lighthouseResult.categories.performance.score * 100;
    } catch (error) {
        console.error(`Error extracting lighthouse metrics for ${url}:`, error);
        console.log(data);
    }

    // Homepage metrics
    try {
        if (data.loadingExperience && data.loadingExperience.metrics) {
            const homepageMetrics = data.loadingExperience.metrics;
            result.homepage_overall_category = data.loadingExperience.overall_category;

            // TTFB with category
            if (homepageMetrics.EXPERIMENTAL_TIME_TO_FIRST_BYTE) {
                result.homepage_ttfb_category = homepageMetrics.EXPERIMENTAL_TIME_TO_FIRST_BYTE.category;
                result.homepage_ttfb_75th = homepageMetrics.EXPERIMENTAL_TIME_TO_FIRST_BYTE.percentile;
                result.homepage_ttfb_good = homepageMetrics.EXPERIMENTAL_TIME_TO_FIRST_BYTE.distributions[0].proportion * 100;
                result.homepage_ttfb_needs_improvement = homepageMetrics.EXPERIMENTAL_TIME_TO_FIRST_BYTE.distributions[1].proportion * 100;
                result.homepage_ttfb_poor = homepageMetrics.EXPERIMENTAL_TIME_TO_FIRST_BYTE.distributions[2].proportion * 100;
            }

            // LCP
            if (homepageMetrics.LARGEST_CONTENTFUL_PAINT_MS) {
                result.homepage_lcp_75th = homepageMetrics.LARGEST_CONTENTFUL_PAINT_MS.percentile;
                result.homepage_lcp_good = homepageMetrics.LARGEST_CONTENTFUL_PAINT_MS.distributions[0].proportion * 100;
                result.homepage_lcp_needs_improvement = homepageMetrics.LARGEST_CONTENTFUL_PAINT_MS.distributions[1].proportion * 100;
                result.homepage_lcp_poor = homepageMetrics.LARGEST_CONTENTFUL_PAINT_MS.distributions[2].proportion * 100;
            }

            // INP
            if (homepageMetrics.INTERACTION_TO_NEXT_PAINT) {
                result.homepage_inp_75th = homepageMetrics.INTERACTION_TO_NEXT_PAINT.percentile;
                result.homepage_inp_good = homepageMetrics.INTERACTION_TO_NEXT_PAINT.distributions[0].proportion * 100;
                result.homepage_inp_needs_improvement = homepageMetrics.INTERACTION_TO_NEXT_PAINT.distributions[1].proportion * 100;
                result.homepage_inp_poor = homepageMetrics.INTERACTION_TO_NEXT_PAINT.distributions[2].proportion * 100;
            }

            // CLS
            if (homepageMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE) {
                result.homepage_cls_75th = homepageMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile;
                result.homepage_cls_good = homepageMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.distributions[0].proportion * 100;
                result.homepage_cls_needs_improvement = homepageMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.distributions[1].proportion * 100;
                result.homepage_cls_poor = homepageMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.distributions[2].proportion * 100;
            }

            // FCP
            if (homepageMetrics.FIRST_CONTENTFUL_PAINT_MS) {
                result.homepage_fcp_75th = homepageMetrics.FIRST_CONTENTFUL_PAINT_MS.percentile;
                result.homepage_fcp_good = homepageMetrics.FIRST_CONTENTFUL_PAINT_MS.distributions[0].proportion * 100;
                result.homepage_fcp_needs_improvement = homepageMetrics.FIRST_CONTENTFUL_PAINT_MS.distributions[1].proportion * 100;
                result.homepage_fcp_poor = homepageMetrics.FIRST_CONTENTFUL_PAINT_MS.distributions[2].proportion * 100;
            }
        }
    } catch (error) {
        console.error(`Error extracting homepage metrics for ${url}:`, error);
    }

    // Origin metrics
    try {
        if (data.originLoadingExperience && data.originLoadingExperience.metrics) {
            const originMetrics = data.originLoadingExperience.metrics;
            result.origin_overall_category = data.originLoadingExperience.overall_category;

            // TTFB with category
            if (originMetrics.EXPERIMENTAL_TIME_TO_FIRST_BYTE) {
                result.origin_ttfb_category = originMetrics.EXPERIMENTAL_TIME_TO_FIRST_BYTE.category;
                result.origin_ttfb_75th = originMetrics.EXPERIMENTAL_TIME_TO_FIRST_BYTE.percentile;
                result.origin_ttfb_good = originMetrics.EXPERIMENTAL_TIME_TO_FIRST_BYTE.distributions[0].proportion * 100;
                result.origin_ttfb_needs_improvement = originMetrics.EXPERIMENTAL_TIME_TO_FIRST_BYTE.distributions[1].proportion * 100;
                result.origin_ttfb_poor = originMetrics.EXPERIMENTAL_TIME_TO_FIRST_BYTE.distributions[2].proportion * 100;
            }

            // LCP
            if (originMetrics.LARGEST_CONTENTFUL_PAINT_MS) {
                result.origin_lcp_75th = originMetrics.LARGEST_CONTENTFUL_PAINT_MS.percentile;
                result.origin_lcp_good = originMetrics.LARGEST_CONTENTFUL_PAINT_MS.distributions[0].proportion * 100;
                result.origin_lcp_needs_improvement = originMetrics.LARGEST_CONTENTFUL_PAINT_MS.distributions[1].proportion * 100;
                result.origin_lcp_poor = originMetrics.LARGEST_CONTENTFUL_PAINT_MS.distributions[2].proportion * 100;
            }

            // INP
            if (originMetrics.INTERACTION_TO_NEXT_PAINT) {
                result.origin_inp_75th = originMetrics.INTERACTION_TO_NEXT_PAINT.percentile;
                result.origin_inp_good = originMetrics.INTERACTION_TO_NEXT_PAINT.distributions[0].proportion * 100;
                result.origin_inp_needs_improvement = originMetrics.INTERACTION_TO_NEXT_PAINT.distributions[1].proportion * 100;
                result.origin_inp_poor = originMetrics.INTERACTION_TO_NEXT_PAINT.distributions[2].proportion * 100;
            }

            // CLS
            if (originMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE) {
                result.origin_cls_75th = originMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile;
                result.origin_cls_good = originMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.distributions[0].proportion * 100;
                result.origin_cls_needs_improvement = originMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.distributions[1].proportion * 100;
                result.origin_cls_poor = originMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.distributions[2].proportion * 100;
            }

            // FCP
            if (originMetrics.FIRST_CONTENTFUL_PAINT_MS) {
                result.origin_fcp_75th = originMetrics.FIRST_CONTENTFUL_PAINT_MS.percentile;
                result.origin_fcp_good = originMetrics.FIRST_CONTENTFUL_PAINT_MS.distributions[0].proportion * 100;
                result.origin_fcp_needs_improvement = originMetrics.FIRST_CONTENTFUL_PAINT_MS.distributions[1].proportion * 100;
                result.origin_fcp_poor = originMetrics.FIRST_CONTENTFUL_PAINT_MS.distributions[2].proportion * 100;
            }
        }
    } catch (error) {
        console.error(`Error extracting origin metrics for ${url}:`, error);
    }

    return result;
}

// Helper function to create error object with all fields set to 'N/A'
function getErrorObject(url) {
    return {
        url: url,
        lighthouse_lcp: 'N/A',
        lighthouse_fcp: 'N/A',
        lighthouse_cls: 'N/A',
        lighthouse_performance_score: 'N/A',
        homepage_overall_category: 'N/A',
        homepage_lcp_75th: 'N/A',
        homepage_lcp_good: 'N/A',
        homepage_lcp_needs_improvement: 'N/A',
        homepage_lcp_poor: 'N/A',
        homepage_inp_75th: 'N/A',
        homepage_inp_good: 'N/A',
        homepage_inp_needs_improvement: 'N/A',
        homepage_inp_poor: 'N/A',
        homepage_cls_75th: 'N/A',
        homepage_cls_good: 'N/A',
        homepage_cls_needs_improvement: 'N/A',
        homepage_cls_poor: 'N/A',
        homepage_fcp_75th: 'N/A',
        homepage_fcp_good: 'N/A',
        homepage_fcp_needs_improvement: 'N/A',
        homepage_fcp_poor: 'N/A',
        origin_overall_category: 'N/A',
        origin_lcp_75th: 'N/A',
        origin_lcp_good: 'N/A',
        origin_lcp_needs_improvement: 'N/A',
        origin_lcp_poor: 'N/A',
        origin_inp_75th: 'N/A',
        origin_inp_good: 'N/A',
        origin_inp_needs_improvement: 'N/A',
        origin_inp_poor: 'N/A',
        origin_cls_75th: 'N/A',
        origin_cls_good: 'N/A',
        origin_cls_needs_improvement: 'N/A',
        origin_cls_poor: 'N/A',
        origin_fcp_75th: 'N/A',
        origin_fcp_good: 'N/A',
        origin_fcp_needs_improvement: 'N/A',
        origin_fcp_poor: 'N/A',
        homepage_ttfb_75th: 'N/A',
        homepage_ttfb_good: 'N/A',
        homepage_ttfb_needs_improvement: 'N/A',
        homepage_ttfb_poor: 'N/A',
        origin_ttfb_75th: 'N/A',
        origin_ttfb_good: 'N/A',
        origin_ttfb_needs_improvement: 'N/A',
        origin_ttfb_poor: 'N/A',
        homepage_ttfb_category: 'N/A',
        origin_ttfb_category: 'N/A'
    };
}

// Define all headers
const headers = [
    {id: 'url', title: 'Website'},
    {id: 'company', title: 'Company'},
    {id: 'revenue', title: 'Revenue'},
    {id: 'primary_industry', title: 'Primary Industry'},
    {id: 'primary_sub_industry', title: 'Primary Sub-Industry'},
    {id: 'linkedin_url', title: 'LinkedIn Company Profile URL'},
    {id: 'business_model', title: 'Business Model'},
    {id: 'company_state', title: 'Company State'},
    {id: 'lighthouse_lcp', title: 'Lighthouse LCP'},
    {id: 'lighthouse_fcp', title: 'Lighthouse FCP'},
    {id: 'lighthouse_cls', title: 'Lighthouse CLS'},
    {id: 'lighthouse_performance_score', title: 'Lighthouse Performance Score'},
    
    // Homepage metrics
    {id: 'homepage_overall_category', title: 'Homepage Overall Category'},
    {id: 'homepage_lcp_75th', title: 'Homepage LCP 75th Percentile'},
    {id: 'homepage_lcp_good', title: 'Homepage LCP Good %'},
    {id: 'homepage_lcp_needs_improvement', title: 'Homepage LCP Needs Improvement %'},
    {id: 'homepage_lcp_poor', title: 'Homepage LCP Poor %'},
    
    {id: 'homepage_inp_75th', title: 'Homepage INP 75th Percentile'},
    {id: 'homepage_inp_good', title: 'Homepage INP Good %'},
    {id: 'homepage_inp_needs_improvement', title: 'Homepage INP Needs Improvement %'},
    {id: 'homepage_inp_poor', title: 'Homepage INP Poor %'},
    
    {id: 'homepage_cls_75th', title: 'Homepage CLS 75th Percentile'},
    {id: 'homepage_cls_good', title: 'Homepage CLS Good %'},
    {id: 'homepage_cls_needs_improvement', title: 'Homepage CLS Needs Improvement %'},
    {id: 'homepage_cls_poor', title: 'Homepage CLS Poor %'},
    
    {id: 'homepage_fcp_75th', title: 'Homepage FCP 75th Percentile'},
    {id: 'homepage_fcp_good', title: 'Homepage FCP Good %'},
    {id: 'homepage_fcp_needs_improvement', title: 'Homepage FCP Needs Improvement %'},
    {id: 'homepage_fcp_poor', title: 'Homepage FCP Poor %'},

    {id: 'homepage_ttfb_category', title: 'Homepage TTFB Category'},
    {id: 'homepage_ttfb_75th', title: 'Homepage TTFB 75th Percentile'},
    {id: 'homepage_ttfb_good', title: 'Homepage TTFB Good %'},
    {id: 'homepage_ttfb_needs_improvement', title: 'Homepage TTFB Needs Improvement %'},
    {id: 'homepage_ttfb_poor', title: 'Homepage TTFB Poor %'},
    
    // Origin metrics
    {id: 'origin_overall_category', title: 'Origin Overall Category'},
    {id: 'origin_lcp_75th', title: 'Origin LCP 75th Percentile'},
    {id: 'origin_lcp_good', title: 'Origin LCP Good %'},
    {id: 'origin_lcp_needs_improvement', title: 'Origin LCP Needs Improvement %'},
    {id: 'origin_lcp_poor', title: 'Origin LCP Poor %'},
    
    {id: 'origin_inp_75th', title: 'Origin INP 75th Percentile'},
    {id: 'origin_inp_good', title: 'Origin INP Good %'},
    {id: 'origin_inp_needs_improvement', title: 'Origin INP Needs Improvement %'},
    {id: 'origin_inp_poor', title: 'Origin INP Poor %'},
    
    {id: 'origin_cls_75th', title: 'Origin CLS 75th Percentile'},
    {id: 'origin_cls_good', title: 'Origin CLS Good %'},
    {id: 'origin_cls_needs_improvement', title: 'Origin CLS Needs Improvement %'},
    {id: 'origin_cls_poor', title: 'Origin CLS Poor %'},
    
    {id: 'origin_fcp_75th', title: 'Origin FCP 75th Percentile'},
    {id: 'origin_fcp_good', title: 'Origin FCP Good %'},
    {id: 'origin_fcp_needs_improvement', title: 'Origin FCP Needs Improvement %'},
    {id: 'origin_fcp_poor', title: 'Origin FCP Poor %'},

    {id: 'origin_ttfb_category', title: 'Origin TTFB Category'},
    {id: 'origin_ttfb_75th', title: 'Origin TTFB 75th Percentile'},
    {id: 'origin_ttfb_good', title: 'Origin TTFB Good %'},
    {id: 'origin_ttfb_needs_improvement', title: 'Origin TTFB Needs Improvement %'},
    {id: 'origin_ttfb_poor', title: 'Origin TTFB Poor %'}
];

// Process URLs in batches
async function processBatch(urls, csvWriter) {
    const promises = urls.map(async (url) => {
        try {
            console.log(`Processing: ${url}`);
            const result = await analyzeUrl(url);
            await csvWriter.writeRecords([result]);
            console.log(`Completed: ${url}`);
            return result;
        } catch (error) {
            console.error(`Error processing ${url}:`, error);
            return null;
        }
    });

    return Promise.all(promises);
}

async function processUrls() {
    // Create CSV writer with all headers
    const csvWriter = createObjectCsvWriter({
        path: 'results.csv',
        header: headers
    });

    try {
        // Read URLs and create batches with all relevant data
        const records = [];
        const parser = fs.createReadStream('retail-master.csv')
            .pipe(parse({
                columns: true,
                skip_empty_lines: true
            }));

        for await (const record of parser) {
            records.push({
                url: record.website,
                company: record.Company,
                revenue: record.Revenue,
                primary_industry: record['Primary Industry'],
                primary_sub_industry: record['Primary Sub-Industry'],
                linkedin_url: record['LinkedIn Company Profile URL'],
                business_model: record['Business Model'],
                company_state: record['Company State']
            });
        }

        // Process in batches
        for (let i = 0; i < records.length; i += BATCH_SIZE) {
            const batch = records.slice(i, i + BATCH_SIZE);
            console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(records.length/BATCH_SIZE)}`);
            
            const promises = batch.map(async (record) => {
                try {
                    console.log(`Processing: ${record.url}`);
                    const psiResult = await analyzeUrl(record.url);
                    
                    // Combine PSI results with retail-master data
                    const combinedResult = {
                        ...record,
                        ...psiResult
                    };
                    
                    await csvWriter.writeRecords([combinedResult]);
                    console.log(`Completed: ${record.url}`);
                } catch (error) {
                    console.error(`Error processing ${record.url}:`, error);
                }
            });

            await Promise.all(promises);
            
            if (i + BATCH_SIZE < records.length) {
                console.log(`Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
                await sleep(DELAY_BETWEEN_BATCHES);
            }
        }

        console.log('All URLs processed successfully');
    } catch (error) {
        console.error('Error:', error);
    }
}

// Run the script
processUrls().catch(console.error); 