const natural = require('natural');
const TfIdf = require('natural').TfIdf;
const tfidf = new TfIdf();
const tokenizer = new natural.WordTokenizer();
const sentiment = new natural.SentimentAnalyzer("English", natural.PorterStemmer, "afinn");

// Theme definitions with comprehensive keywords and patterns
const themeDefinitions = {
    leadership: {
        keywords: ['leadership', 'management', 'leader', 'supervisor', 'boss', 'direction', 'vision', 'strategy'],
        relatedFields: ['leadership', 'overallRating'],
        ratingThreshold: 7,
        description: 'Quality of leadership and management'
    },
    compensation: {
        keywords: ['salary', 'pay', 'compensation', 'benefits', 'bonus', 'package', 'insurance', 'perks'],
        relatedFields: ['compensation'],
        ratingThreshold: 0, // Special handling for compensation
        description: 'Compensation and benefits package'
    },
    workLifeBalance: {
        keywords: ['balance', 'hours', 'flexible', 'schedule', 'time', 'family', 'life', 'workload'],
        relatedFields: ['workLifeBalance', 'flexibility'],
        ratingThreshold: 7,
        description: 'Balance between work and personal life'
    },
    careerGrowth: {
        keywords: ['growth', 'learning', 'career', 'development', 'promotion', 'opportunities', 'skills', 'training'],
        relatedFields: ['careerGrowth'],
        ratingThreshold: 7,
        description: 'Career development and learning opportunities'
    },
    innovation: {
        keywords: ['innovation', 'technology', 'creative', 'innovative', 'cutting-edge', 'modern', 'advanced'],
        relatedFields: ['innovation'],
        ratingThreshold: 7,
        description: 'Company innovation and technological advancement'
    },
    culture: {
        keywords: ['culture', 'environment', 'atmosphere', 'team', 'colleagues', 'collaborative', 'inclusive'],
        relatedFields: ['overallRating'],
        ratingThreshold: 7,
        description: 'Company culture and work environment'
    }
};

// Comprehensive review validation
class ReviewValidationError extends Error {
    constructor(errors) {
        super('Review validation failed');
        this.errors = errors;
        this.name = 'ReviewValidationError';
    }
}

const validateReview = (review) => {
    const errors = [];
    
    // Required fields validation
    const requiredFields = [
        { field: 'workLifeBalance', message: 'Work Life Balance rating is required' },
        { field: 'compensation', message: 'Compensation details are required' }
    ];
    
    requiredFields.forEach(({ field, message }) => {
        if (!review[field]) {
            errors.push(message);
        }
    });
    
    // Rating validations (1-10)
    const ratingFields = [
        { field: 'workLifeBalance', name: 'Work Life Balance' },
        { field: 'careerGrowth', name: 'Career Growth' },
        { field: 'leadership', name: 'Leadership' },
        { field: 'innovation', name: 'Innovation' },
        { field: 'flexibility', name: 'Flexibility' },
        { field: 'overallRating', name: 'Overall Rating' }
    ];
    
    ratingFields.forEach(({ field, name }) => {
        if (review[field] !== undefined) {
            if (!Number.isInteger(review[field]) || review[field] < 1 || review[field] > 10) {
                errors.push(`${name} must be an integer between 1 and 10`);
            }
        }
    });
    
    // Compensation validation
    if (review.compensation) {
        if (!review.compensation.salary || !Number.isFinite(review.compensation.salary) || review.compensation.salary <= 0) {
            errors.push('Valid salary is required in compensation');
        }
        if (!review.compensation.currency || typeof review.compensation.currency !== 'string') {
            errors.push('Valid currency is required in compensation');
        }
    }
    
    // Text field validations
    const textFields = [
        { field: 'reviewHeadline', maxLength: 200, name: 'Review Headline' },
        { field: 'pros', maxLength: 2000, name: 'Pros' },
        { field: 'cons', maxLength: 2000, name: 'Cons' }
    ];
    
    textFields.forEach(({ field, maxLength, name }) => {
        if (review[field] && typeof review[field] === 'string') {
            if (review[field].length > maxLength) {
                errors.push(`${name} must be less than ${maxLength} characters`);
            }
        }
    });
    
    if (errors.length > 0) {
        throw new ReviewValidationError(errors);
    }
    
    return true;
};

// Text analysis utilities
const analyzeText = (text) => {
    const tokens = tokenizer.tokenize(text.toLowerCase());
    const sentimentScore = sentiment.getSentiment(tokens);
    return {
        tokens,
        sentimentScore,
        wordCount: tokens.length
    };
};

// Comprehensive theme analysis
const analyzeTheme = (review, theme, themeDefinition) => {
    try {
        let score = 0;
        const textContent = [
            review.reviewHeadline || '',
            review.pros || '',
            review.cons || ''
        ].join(' ').toLowerCase();
        
        // Text analysis
        const textAnalysis = analyzeText(textContent);
        
        // Keyword matching
        const keywordMatches = themeDefinition.keywords.filter(keyword => 
            textAnalysis.tokens.includes(keyword.toLowerCase())
        ).length;
        
        // Rating analysis
        const ratings = themeDefinition.relatedFields.map(field => {
            if (field === 'compensation') {
                // Special handling for compensation
                return analyzeCompensation(review.compensation);
            }
            return review[field] || 0;
        });
        
        const averageRating = ratings.length > 0 
            ? ratings.reduce((a, b) => a + b, 0) / ratings.length 
            : 0;
        
        // Calculate final score
        score = (
            (keywordMatches * 2) + 
            (textAnalysis.sentimentScore * 3) + 
            ((averageRating - 5) * 2)
        );
        
        return {
            score,
            keywordMatches,
            sentimentScore: textAnalysis.sentimentScore,
            averageRating,
            evidence: extractEvidence(textContent, themeDefinition.keywords)
        };
    } catch (error) {
        throw new Error(`Theme analysis failed for ${theme}: ${error.message}`);
    }
};

// Evidence extraction
const extractEvidence = (text, keywords) => {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    return sentences.filter(sentence => 
        keywords.some(keyword => 
            sentence.toLowerCase().includes(keyword.toLowerCase())
        )
    ).map(sentence => sentence.trim());
};

// Compensation analysis
const analyzeCompensation = (compensation) => {
    // This would typically involve comparing against industry standards
    // For now, using a simplified scoring mechanism
    const score = compensation.salary >= 100000 ? 8 : 
                 compensation.salary >= 75000 ? 7 :
                 compensation.salary >= 50000 ? 6 : 5;
    return score;
};

// Main analysis function
const analyzeReviews = async (reviews) => {
    try {
        // Validate all reviews
        reviews.forEach(validateReview);
        
        const themeAnalysis = {};
        const aggregateMetrics = initializeAggregateMetrics();
        
        // Analyze each review
        for (const review of reviews) {
            // Theme analysis
            for (const [theme, definition] of Object.entries(themeDefinitions)) {
                if (!themeAnalysis[theme]) {
                    themeAnalysis[theme] = {
                        scores: [],
                        evidence: [],
                        keywordMatches: 0,
                        totalSentiment: 0
                    };
                }
                
                const analysis = analyzeTheme(review, theme, definition);
                themeAnalysis[theme].scores.push(analysis.score);
                themeAnalysis[theme].evidence.push(...analysis.evidence);
                themeAnalysis[theme].keywordMatches += analysis.keywordMatches;
                themeAnalysis[theme].totalSentiment += analysis.sentimentScore;
            }
            
            // Update aggregate metrics
            updateAggregateMetrics(aggregateMetrics, review);
        }
        
        // Calculate final results
        const finalResults = calculateFinalResults(themeAnalysis, aggregateMetrics, reviews.length);
        
        return formatResults(finalResults);
        
    } catch (error) {
        console.log(error);
        throw new Error(`Review analysis failed: ${error.message}`);
    }
};

// Initialize aggregate metrics
const initializeAggregateMetrics = () => ({
    ratings: {
        overall: [],
        workLifeBalance: [],
        careerGrowth: [],
        leadership: [],
        innovation: [],
        flexibility: []
    },
    compensation: {
        salaries: [],
        currencies: new Set()
    },
    textStats: {
        totalReviews: 0,
        prosWordCount: 0,
        consWordCount: 0
    }
});

// Update aggregate metrics
const updateAggregateMetrics = (metrics, review) => {
    // Update ratings
    Object.keys(metrics.ratings).forEach(field => {
        if (review[field]) {
            metrics.ratings[field].push(review[field]);
        }
    });
    
    // Update compensation
    if (review.compensation) {
        metrics.compensation.salaries.push(review.compensation.salary);
        metrics.compensation.currencies.add(review.compensation.currency);
    }
    
    // Update text stats
    metrics.textStats.totalReviews++;
    metrics.textStats.prosWordCount += (review.pros ? tokenizer.tokenize(review.pros).length : 0);
    metrics.textStats.consWordCount += (review.cons ? tokenizer.tokenize(review.cons).length : 0);
};

// Calculate final results
const calculateFinalResults = (themeAnalysis, aggregateMetrics, totalReviews) => {
    const results = {
        themes: {
            positive: [],
            negative: [],
            neutral: []
        },
        metrics: calculateMetrics(aggregateMetrics),
        summary: generateSummary(themeAnalysis, aggregateMetrics)
    };
    
    // Categorize themes
    Object.entries(themeAnalysis).forEach(([theme, analysis]) => {
        const averageScore = average(analysis.scores);
        const themeResult = {
            theme,
            score: averageScore,
            evidence: [...new Set(analysis.evidence)], // Remove duplicates
            sentiment: analysis.totalSentiment / totalReviews,
            keywordFrequency: analysis.keywordMatches / totalReviews,
            description: themeDefinitions[theme].description
        };
        
        if (averageScore > 2) {
            results.themes.positive.push(themeResult);
        } else if (averageScore < -2) {
            results.themes.negative.push(themeResult);
        } else {
            results.themes.neutral.push(themeResult);
        }
    });
    
    // Sort themes by absolute score
    ['positive', 'negative', 'neutral'].forEach(category => {
        results.themes[category].sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
    });
    
    return results;
};

// Calculate metrics
const calculateMetrics = (metrics) => {
    return {
        ratings: Object.entries(metrics.ratings).reduce((acc, [key, values]) => {
            acc[key] = {
                average: average(values),
                median: median(values),
                count: values.length
            };
            return acc;
        }, {}),
        compensation: {
            average: average(metrics.compensation.salaries),
            median: median(metrics.compensation.salaries),
            range: {
                min: Math.min(...metrics.compensation.salaries),
                max: Math.max(...metrics.compensation.salaries)
            },
            currencies: Array.from(metrics.compensation.currencies)
        },
        textStats: metrics.textStats
    };
};

// Generate overall summary
const generateSummary = (themeAnalysis, metrics) => {
    const overallSentiment = Object.values(themeAnalysis)
        .reduce((sum, analysis) => sum + analysis.totalSentiment, 0) / metrics.textStats.totalReviews;
    
    return {
        overallSentiment,
        reviewCount: metrics.textStats.totalReviews,
        topStrengths: getTopThemes(themeAnalysis, true),
        topWeaknesses: getTopThemes(themeAnalysis, false)
    };
};

// Helper functions
const average = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

const median = arr => {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const getTopThemes = (themeAnalysis, positive = true) => {
    return Object.entries(themeAnalysis)
        .map(([theme, analysis]) => ({
            theme,
            score: average(analysis.scores)
        }))
        .filter(({ score }) => positive ? score > 0 : score < 0)
        .sort((a, b) => positive ? b.score - a.score : a.score - b.score)
        .slice(0, 3)
        .map(({ theme }) => theme);
};

// Format results for output
const formatResults = (results) => {
    // Clean up and format the results for presentation
    return {
        ...results,
        generatedAt: new Date().toISOString(),
        version: '1.0.0'
    };
};

// const reviews = [
//     {
//       reviewHeadline: 'Exceptional workplace with great opportunities',
//       overallRating: 9,
//       workLifeBalance: 9,
//       compensation: { salary: 135000, currency: 'USD', satisfaction: 9 },
//       careerGrowth: 9,
//       leadership: 9,
//       innovation: 8,
//       flexibility: 9,
//       pros: 'Outstanding leadership team that truly cares about employees. Excellent work-life balance with flexible hours. Competitive salary and comprehensive benefits package. Regular training sessions and clear career progression paths. Modern tech stack and innovative projects.',
//       cons: 'Some projects can be challenging due to tight deadlines, but manageable with good planning.'
//     },
//     {
//       reviewHeadline: 'Good company with some areas for improvement',
//       overallRating: 7,
//       workLifeBalance: 8,
//       compensation: { salary: 100000, currency: 'USD', satisfaction: 7 },
//       careerGrowth: 6,
//       leadership: 7,
//       innovation: 8,
//       flexibility: 8,
//       pros: 'Great work-life balance and flexible scheduling. Good benefits package. Interesting projects with modern technologies. Friendly coworkers and collaborative environment.',
//       cons: 'Career growth could be faster. Some departments lack clear communication channels. Middle management can be inconsistent.'
//     },
//     {
//       reviewHeadline: 'Average workplace, nothing special',
//       overallRating: 5,
//       workLifeBalance: 5,
//       compensation: { salary: 77500, currency: 'USD', satisfaction: 5 },
//       careerGrowth: 5,
//       leadership: 5,
//       innovation: 5,
//       flexibility: 6,
//       pros: 'Standard benefits package. Decent work environment. Some flexibility with work hours. Office location is convenient.',
//       cons: 'No standout qualities. Projects can be mundane. Limited innovation. Average salary for the industry.'
//     },
//     {
//       reviewHeadline: 'Declining work environment with some positive aspects',
//       overallRating: 4,
//       workLifeBalance: 3,
//       compensation: { salary: 72500, currency: 'USD', satisfaction: 6 },
//       careerGrowth: 4,
//       leadership: 3,
//       innovation: 5,
//       flexibility: 7,
//       pros: 'Good health insurance benefits. Flexible work arrangements. Some talented coworkers. Office facilities are nice.',
//       cons: 'Poor work-life balance with frequent overtime. Leadership seems disconnected from employees. Limited career growth opportunities. Outdated technologies in some departments.'
//     },
//     {
//       reviewHeadline: 'Challenging environment with serious issues',
//       overallRating: 2,
//       workLifeBalance: 2,
//       compensation: { salary: 67500, currency: 'USD', satisfaction: 3 },
//       careerGrowth: 2,
//       leadership: 2,
//       innovation: 3,
//       flexibility: 3,
//       pros: 'Basic health insurance coverage. Some friendly colleagues. Office location is central.',
//       cons: 'Toxic management culture. Below-market compensation. No work-life balance with constant pressure. Outdated technologies and resistance to change. High turnover rate. Poor communication from leadership. Limited growth opportunities.'
//     },
//     {
//       reviewHeadline: 'Innovative projects but demanding environment',
//       overallRating: 6,
//       workLifeBalance: 4,
//       compensation: { salary: 107500, currency: 'USD', satisfaction: 7 },
//       careerGrowth: 7,
//       leadership: 5,
//       innovation: 9,
//       flexibility: 4,
//       pros: 'Cutting-edge technology stack. Exciting innovative projects. Good learning opportunities. Competitive salary. Strong technical leadership.',
//       cons: 'Poor work-life balance. High pressure environment. Frequent overtime required. Inconsistent management practices.'
//     },
//     {
//       reviewHeadline: 'Amazing culture but average compensation',
//       overallRating: 7,
//       workLifeBalance: 9,
//       compensation: { salary: 77500, currency: 'USD', satisfaction: 5 },
//       careerGrowth: 6,
//       leadership: 8,
//       innovation: 6,
//       flexibility: 9,
//       pros: 'Exceptional company culture. Strong focus on employee wellbeing. Great work-life balance. Supportive management. Flexible working hours. Strong team collaboration.',
//       cons: 'Below-market compensation. Limited advanced career opportunities. Some outdated tools and processes.'
//     },
//     {
//       reviewHeadline: 'Great learning curve but stressful environment',
//       overallRating: 6,
//       workLifeBalance: 4,
//       compensation: { salary: 92500, currency: 'USD', satisfaction: 6 },
//       careerGrowth: 9,
//       leadership: 6,
//       innovation: 7,
//       flexibility: 5,
//       pros: 'Excellent learning opportunities. Fast career progression. Mentorship programs. Modern tech stack. Regular training sessions.',
//       cons: 'Work-life balance needs improvement. High-stress environment. Frequent deadlines. Some teams understaffed.'
//     }
//   ];

//   const reviews = [
//     {
//         headline: "Great place to work",
//         overallRating: 8,
//         workLifeBalance: 9,
//         compensation: {
//             salary: 100000,
//             currency: "USD"
//         },
//         careerGrowth: 7,
//         leadership: 8,
//         innovation: 8,
//         flexibility: 9,
//         pros: "Excellent work-life balance, good leadership",
//         cons: "Sometimes slow decision making"
//     }
//     // ... more reviews
// ];




const badReviews = [
    {
        reviewHeadline: "Toxic workplace with no redeeming qualities",
        overallRating: 1,
        workLifeBalance: 1,
        compensation: { salary: 50000, currency: "USD", satisfaction: 1 },
        careerGrowth: 1,
        leadership: 1,
        innovation: 1,
        flexibility: 1,
        pros: "Central office location.",
        cons: "Extremely toxic environment. Poor leadership with no transparency. Zero career growth opportunities. Outdated tools and technologies. Employees are overworked and undervalued."
    },
    {
        reviewHeadline: "Worst company I’ve ever worked for",
        overallRating: 1,
        workLifeBalance: 1,
        compensation: { salary: 45000, currency: "USD", satisfaction: 1 },
        careerGrowth: 1,
        leadership: 2,
        innovation: 1,
        flexibility: 2,
        pros: "Coffee machine is decent.",
        cons: "Micromanagement at every level. No work-life balance. Salaries are below market standards. Constant pressure with no recognition. Toxic culture and lack of respect for employees."
    },
    {
        reviewHeadline: "Avoid this company at all costs",
        overallRating: 1,
        workLifeBalance: 2,
        compensation: { salary: 48000, currency: "USD", satisfaction: 2 },
        careerGrowth: 1,
        leadership: 1,
        innovation: 2,
        flexibility: 2,
        pros: "Some coworkers are nice.",
        cons: "Absolutely no career development. Poor management with no vision. Stagnant innovation. Work-life balance is a joke. Compensation is far below industry standards."
    },
    {
        reviewHeadline: "Horrible experience, not worth it",
        overallRating: 2,
        workLifeBalance: 2,
        compensation: { salary: 55000, currency: "USD", satisfaction: 2 },
        careerGrowth: 2,
        leadership: 1,
        innovation: 2,
        flexibility: 1,
        pros: "They pay on time.",
        cons: "Leadership is entirely disconnected from reality. The company is stuck in old processes. No flexibility or autonomy. Frequent unpaid overtime. Zero support for employees."
    },
    {
        reviewHeadline: "Extremely poor management and culture",
        overallRating: 1,
        workLifeBalance: 1,
        compensation: { salary: 47000, currency: "USD", satisfaction: 1 },
        careerGrowth: 1,
        leadership: 1,
        innovation: 1,
        flexibility: 1,
        pros: "The office is clean.",
        cons: "Leadership promotes a toxic and hostile work environment. Employees are treated as expendable. Lack of innovation. No career progression. Compensation is insultingly low."
    },
    {
        reviewHeadline: "Terrible place to work, stay away",
        overallRating: 2,
        workLifeBalance: 1,
        compensation: { salary: 52000, currency: "USD", satisfaction: 2 },
        careerGrowth: 1,
        leadership: 1,
        innovation: 1,
        flexibility: 2,
        pros: "The building has parking.",
        cons: "Overworked and underpaid employees. No room for growth. Managers have no empathy or leadership skills. Work-life balance is nonexistent. Outdated tools and constant micromanagement."
    },
    {
        reviewHeadline: "Worst decision of my career",
        overallRating: 1,
        workLifeBalance: 1,
        compensation: { salary: 49000, currency: "USD", satisfaction: 1 },
        careerGrowth: 1,
        leadership: 1,
        innovation: 1,
        flexibility: 1,
        pros: "Free coffee.",
        cons: "Terrible management. No work-life balance. High employee turnover. Outdated and unproductive work culture. The pay does not justify the stress and lack of respect."
    },
    {
        reviewHeadline: "Awful workplace with no future",
        overallRating: 2,
        workLifeBalance: 2,
        compensation: { salary: 51000, currency: "USD", satisfaction: 2 },
        careerGrowth: 1,
        leadership: 2,
        innovation: 1,
        flexibility: 2,
        pros: "Somewhat decent office chairs.",
        cons: "Management is clueless and unapproachable. Lack of direction or clear goals. Employees are burned out with no recognition. Pay is low compared to industry standards."
    },
    {
        reviewHeadline: "Stay far away from this company",
        overallRating: 1,
        workLifeBalance: 1,
        compensation: { salary: 47000, currency: "USD", satisfaction: 1 },
        careerGrowth: 1,
        leadership: 1,
        innovation: 1,
        flexibility: 1,
        pros: "Nothing significant.",
        cons: "The company doesn’t care about its employees. Outdated tech stack. No flexibility or support. Toxic culture and extremely poor management. Compensation is terrible."
    },
    {
        reviewHeadline: "Completely demoralizing environment",
        overallRating: 1,
        workLifeBalance: 1,
        compensation: { salary: 46000, currency: "USD", satisfaction: 1 },
        careerGrowth: 1,
        leadership: 1,
        innovation: 1,
        flexibility: 1,
        pros: "You can leave at the end of the day.",
        cons: "Demoralizing and disrespectful management. Employees are treated as numbers. No innovative projects. Overworked staff with low pay. Toxic environment with no growth opportunities."
    }
];

const goodReviews = [
    {
        reviewHeadline: "Exceptional workplace with outstanding culture",
        overallRating: 9,
        workLifeBalance: 9,
        compensation: { salary: 140000, currency: "USD", satisfaction: 9 },
        careerGrowth: 9,
        leadership: 9,
        innovation: 8,
        flexibility: 9,
        pros: "Incredible leadership. Work-life balance is prioritized. Competitive salary and comprehensive benefits. Collaborative and inclusive culture. Opportunities for growth and innovation.",
        cons: "Occasional tight deadlines, but manageable with planning."
    },
    {
        reviewHeadline: "Best company I've ever worked for",
        overallRating: 10,
        workLifeBalance: 10,
        compensation: { salary: 150000, currency: "USD", satisfaction: 10 },
        careerGrowth: 10,
        leadership: 10,
        innovation: 9,
        flexibility: 10,
        pros: "Phenomenal work environment. Flexible hours and unlimited PTO. Exceptional pay and benefits. Encouraging leadership. Plenty of growth opportunities and cutting-edge technology.",
        cons: "Nothing significant."
    },
    {
        reviewHeadline: "Amazing culture and career growth opportunities",
        overallRating: 9,
        workLifeBalance: 9,
        compensation: { salary: 130000, currency: "USD", satisfaction: 9 },
        careerGrowth: 10,
        leadership: 9,
        innovation: 9,
        flexibility: 9,
        pros: "Supportive culture. Clear paths for career progression. Innovative projects. Great work-life balance. Excellent health and retirement benefits.",
        cons: "High expectations can sometimes be stressful, but support is available."
    },
    {
        reviewHeadline: "A dream company for any professional",
        overallRating: 10,
        workLifeBalance: 10,
        compensation: { salary: 145000, currency: "USD", satisfaction: 10 },
        careerGrowth: 10,
        leadership: 10,
        innovation: 10,
        flexibility: 10,
        pros: "World-class leadership team. Inspiring projects. Collaborative work culture. Excellent pay and flexibility. Encouragement for professional development.",
        cons: "None to mention."
    },
    {
        reviewHeadline: "Outstanding workplace with inspiring leadership",
        overallRating: 9,
        workLifeBalance: 9,
        compensation: { salary: 135000, currency: "USD", satisfaction: 9 },
        careerGrowth: 9,
        leadership: 10,
        innovation: 8,
        flexibility: 9,
        pros: "Fantastic leadership. Focus on employee wellbeing. Modern tech stack. Competitive salary. Flexible schedules. Great team dynamics.",
        cons: "Rapid pace might not suit everyone."
    },
    {
        reviewHeadline: "Incredible learning and career development opportunities",
        overallRating: 10,
        workLifeBalance: 9,
        compensation: { salary: 140000, currency: "USD", satisfaction: 9 },
        careerGrowth: 10,
        leadership: 10,
        innovation: 9,
        flexibility: 9,
        pros: "Endless opportunities for learning. Great mentorship. Strong focus on innovation. Excellent pay and benefits. Flexible working hours.",
        cons: "Fast-paced work environment."
    },
    {
        reviewHeadline: "Supportive management and exciting projects",
        overallRating: 9,
        workLifeBalance: 8,
        compensation: { salary: 125000, currency: "USD", satisfaction: 8 },
        careerGrowth: 9,
        leadership: 9,
        innovation: 9,
        flexibility: 8,
        pros: "Engaging projects. Transparent leadership. Great collaboration across teams. Modern tools and technologies. Growth-oriented culture.",
        cons: "Workload can be heavy at times."
    },
    {
        reviewHeadline: "Highly innovative and rewarding environment",
        overallRating: 9,
        workLifeBalance: 9,
        compensation: { salary: 140000, currency: "USD", satisfaction: 9 },
        careerGrowth: 9,
        leadership: 9,
        innovation: 10,
        flexibility: 9,
        pros: "Encourages creativity and innovation. Amazing perks. High-performing teams. Inclusive culture. Focus on employee happiness and growth.",
        cons: "Occasional long hours during product launches."
    },
    {
        reviewHeadline: "Perfect blend of culture and innovation",
        overallRating: 10,
        workLifeBalance: 10,
        compensation: { salary: 150000, currency: "USD", satisfaction: 10 },
        careerGrowth: 10,
        leadership: 10,
        innovation: 10,
        flexibility: 10,
        pros: "Exceptional work-life balance. Employee-first approach. Cutting-edge technologies. Opportunities for constant learning. High salary with excellent perks.",
        cons: "None worth mentioning."
    },
    {
        reviewHeadline: "Inspiring workplace with great benefits",
        overallRating: 9,
        workLifeBalance: 9,
        compensation: { salary: 130000, currency: "USD", satisfaction: 9 },
        careerGrowth: 9,
        leadership: 9,
        innovation: 8,
        flexibility: 9,
        pros: "Supportive and approachable leadership. Competitive salary and benefits. Collaborative teams. Innovative projects. Focus on employee growth and happiness.",
        cons: "Fast-paced nature may not suit everyone."
    }
];

const averageReviews = [
    {
        reviewHeadline: "Decent workplace with some room for improvement",
        overallRating: 6,
        workLifeBalance: 6,
        compensation: { salary: 85000, currency: "USD", satisfaction: 6 },
        careerGrowth: 6,
        leadership: 6,
        innovation: 7,
        flexibility: 6,
        pros: "Friendly colleagues and supportive teams. Stable work environment. Decent salary and benefits. Some innovative projects.",
        cons: "Limited career growth opportunities. Processes can be slow. Leadership could be more engaged."
    },
    {
        reviewHeadline: "Good but not exceptional",
        overallRating: 5,
        workLifeBalance: 5,
        compensation: { salary: 80000, currency: "USD", satisfaction: 5 },
        careerGrowth: 6,
        leadership: 5,
        innovation: 6,
        flexibility: 5,
        pros: "Average work-life balance. Standard compensation package. Decent flexibility with work hours. Projects are manageable.",
        cons: "Work can feel monotonous. Limited innovation. Leadership could improve in communication."
    },
    {
        reviewHeadline: "A balanced workplace with some challenges",
        overallRating: 6,
        workLifeBalance: 7,
        compensation: { salary: 90000, currency: "USD", satisfaction: 6 },
        careerGrowth: 5,
        leadership: 5,
        innovation: 6,
        flexibility: 7,
        pros: "Flexible work arrangements. Fair salary. Friendly coworkers. Good office location.",
        cons: "Career progression is slow. Leadership feels disconnected from day-to-day operations."
    },
    {
        reviewHeadline: "Okay company with average offerings",
        overallRating: 5,
        workLifeBalance: 5,
        compensation: { salary: 78000, currency: "USD", satisfaction: 5 },
        careerGrowth: 5,
        leadership: 5,
        innovation: 5,
        flexibility: 6,
        pros: "Standard benefits package. Team members are approachable. Work environment is stable.",
        cons: "Nothing stands out as excellent. Salary is industry average. Career growth options are limited."
    },
    {
        reviewHeadline: "Steady work but not very exciting",
        overallRating: 6,
        workLifeBalance: 6,
        compensation: { salary: 82000, currency: "USD", satisfaction: 6 },
        careerGrowth: 5,
        leadership: 6,
        innovation: 5,
        flexibility: 6,
        pros: "Reliable paycheck. Decent work-life balance. Some flexibility in scheduling.",
        cons: "Work can feel repetitive. Not much focus on innovation or creativity."
    },
    {
        reviewHeadline: "A safe but unremarkable choice",
        overallRating: 5,
        workLifeBalance: 5,
        compensation: { salary: 75000, currency: "USD", satisfaction: 5 },
        careerGrowth: 5,
        leadership: 5,
        innovation: 5,
        flexibility: 5,
        pros: "Stable company with no major surprises. Basic benefits and a good team environment.",
        cons: "Compensation is on the lower end. Limited opportunities for skill growth. Conservative management."
    },
    {
        reviewHeadline: "Decent experience but lacks spark",
        overallRating: 6,
        workLifeBalance: 7,
        compensation: { salary: 86000, currency: "USD", satisfaction: 6 },
        careerGrowth: 6,
        leadership: 6,
        innovation: 6,
        flexibility: 7,
        pros: "Good work-life balance. Friendly coworkers. Stable and predictable workload.",
        cons: "Little room for innovation. Career growth is slow. Pay could be better."
    },
    {
        reviewHeadline: "Meets expectations, but not beyond",
        overallRating: 5,
        workLifeBalance: 6,
        compensation: { salary: 80000, currency: "USD", satisfaction: 5 },
        careerGrowth: 5,
        leadership: 5,
        innovation: 6,
        flexibility: 6,
        pros: "Work-life balance is manageable. Teams are collaborative. Office environment is comfortable.",
        cons: "Leadership lacks vision. Innovation is limited. Salary is average."
    },
    {
        reviewHeadline: "Not bad, but could be better",
        overallRating: 6,
        workLifeBalance: 6,
        compensation: { salary: 85000, currency: "USD", satisfaction: 6 },
        careerGrowth: 6,
        leadership: 6,
        innovation: 6,
        flexibility: 6,
        pros: "Friendly teams and approachable management. Decent compensation package. Stable workload.",
        cons: "Slow decision-making processes. Limited scope for growth. Office culture could be more engaging."
    },
    {
        reviewHeadline: "Average company with predictable environment",
        overallRating: 5,
        workLifeBalance: 5,
        compensation: { salary: 78000, currency: "USD", satisfaction: 5 },
        careerGrowth: 5,
        leadership: 5,
        innovation: 5,
        flexibility: 5,
        pros: "Predictable work hours. Standard benefits. Decent workplace environment.",
        cons: "Not very challenging. Leadership lacks clear direction. Average compensation."
    }
];

const reviews = [...averageReviews, ...goodReviews, ...badReviews];

(async() => {
    const d = await analyzeReviews(reviews);
    console.log(JSON.stringify(d));
})();

module.exports = {
    analyzeReviews,
    validateReview,
    ReviewValidationError
};