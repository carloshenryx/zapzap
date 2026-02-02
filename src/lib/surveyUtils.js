/**
 * Survey Advanced Features Utilities
 * Handles: Skip Logic, Voucher Evaluation, Google Redirect Logic
 */

// ============================================
// SKIP LOGIC
// ============================================

/**
 * Operators for skip logic conditions
 */
export const SKIP_LOGIC_OPERATORS = {
    equals: (answer, expected) => {
        // Handle both string and number comparisons
        return String(answer) === String(expected);
    },
    not_equals: (answer, expected) => {
        return String(answer) !== String(expected);
    },
    greater_than: (answer, expected) => {
        const answerNum = Number(answer);
        const expectedNum = Number(expected);
        return !isNaN(answerNum) && !isNaN(expectedNum) && answerNum > expectedNum;
    },
    less_than: (answer, expected) => {
        const answerNum = Number(answer);
        const expectedNum = Number(expected);
        return !isNaN(answerNum) && !isNaN(expectedNum) && answerNum < expectedNum;
    },
    greater_or_equal: (answer, expected) => {
        const answerNum = Number(answer);
        const expectedNum = Number(expected);
        return !isNaN(answerNum) && !isNaN(expectedNum) && answerNum >= expectedNum;
    },
    less_or_equal: (answer, expected) => {
        const answerNum = Number(answer);
        const expectedNum = Number(expected);
        return !isNaN(answerNum) && !isNaN(expectedNum) && answerNum <= expectedNum;
    },
    contains: (answer, expected) => {
        return String(answer).toLowerCase().includes(String(expected).toLowerCase());
    }
};

/**
 * Evaluate skip logic for a question based on answer
 * @param {Object} question - Question with skip_logic configuration
 * @param {any} answer - Current answer
 * @returns {string|null} - Question ID to skip to, or null to continue normally
 */
export function evaluateSkipLogic(question, answer) {
    if (!question?.skip_logic?.enabled) {
        return null;
    }

    const { conditions } = question.skip_logic;

    if (!conditions || !Array.isArray(conditions)) {
        return null;
    }

    // Check each condition
    for (const condition of conditions) {
        const operator = SKIP_LOGIC_OPERATORS[condition.operator];

        if (!operator) {
            console.warn(`Unknown skip logic operator: ${condition.operator}`);
            continue;
        }

        try {
            const matches = operator(answer, condition.answer_value);

            if (matches) {
                return condition.skip_to_question_id;
            }
        } catch (error) {
            console.error('Skip logic evaluation error:', error);
            continue;
        }
    }

    return null;
}

/**
 * Validate skip logic configuration
 * @param {Array} questions - Array of questions
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
export function validateSkipLogic(questions) {
    const errors = [];
    const questionIds = questions.map(q => q.id);

    questions.forEach((question, index) => {
        if (!question.skip_logic?.enabled) return;

        const { conditions } = question.skip_logic;

        if (!conditions || !Array.isArray(conditions)) {
            errors.push(`Question ${index + 1}: Invalid skip logic conditions`);
            return;
        }

        conditions.forEach((condition, condIndex) => {
            // Check if target question exists
            if (condition.skip_to_question_id !== '__END_SURVEY__' &&
                !questionIds.includes(condition.skip_to_question_id)) {
                errors.push(
                    `Question ${index + 1}, Condition ${condIndex + 1}: ` +
                    `Target question "${condition.skip_to_question_id}" not found`
                );
            }

            // Check for self-reference
            if (condition.skip_to_question_id === question.id) {
                errors.push(
                    `Question ${index + 1}, Condition ${condIndex + 1}: ` +
                    `Cannot skip to same question`
                );
            }

            // Warn about backward jumps
            const targetIndex = questions.findIndex(q => q.id === condition.skip_to_question_id);
            if (targetIndex >= 0 && targetIndex <= index) {
                console.warn(
                    `Question ${index + 1} skips backward to question ${targetIndex + 1}. ` +
                    `This may cause confusion.`
                );
            }
        });
    });

    return {
        valid: errors.length === 0,
        errors
    };
}

// ============================================
// VOUCHER EVALUATION
// ============================================

/**
 * Evaluate simple voucher conditions
 * @param {number} overallRating - Overall rating (1-5)
 * @param {boolean} wouldRecommend - Would recommend boolean
 * @param {Object} condition - Simple condition config
 * @returns {boolean}
 */
function evaluateSimpleVoucherCondition(overallRating, wouldRecommend, condition) {
    const meetsRating = overallRating >= (condition.min_rating || 0);
    const meetsRecommendation = !condition.require_recommendation || wouldRecommend === true;

    return meetsRating && meetsRecommendation;
}

/**
 * Evaluate complex voucher conditions
 * @param {Object} customAnswers - Map of question_id -> answer
 * @param {Object} condition - Complex condition config
 * @returns {boolean}
 */
function evaluateComplexVoucherCondition(customAnswers, condition) {
    const { question_conditions, logic_operator } = condition;

    if (!question_conditions || !Array.isArray(question_conditions)) {
        return false;
    }

    const results = question_conditions.map(qc => {
        const answer = customAnswers[qc.question_id];
        const operator = SKIP_LOGIC_OPERATORS[qc.operator];

        if (!operator) {
            console.warn(`Unknown operator in voucher condition: ${qc.operator}`);
            return false;
        }

        try {
            return operator(answer, qc.expected_value);
        } catch (error) {
            console.error('Complex voucher condition error:', error);
            return false;
        }
    });

    if (logic_operator === 'AND') {
        return results.every(r => r === true);
    } else if (logic_operator === 'OR') {
        return results.some(r => r === true);
    }

    return false;
}

/**
 * Check if customer should receive voucher
 * @param {Object} response - Survey response data
 * @param {Object} voucherConfig - Voucher configuration from template
 * @returns {boolean}
 */
export function shouldGrantVoucher(response, voucherConfig) {
    if (!voucherConfig?.enabled) {
        return false;
    }

    const { conditions } = voucherConfig;

    if (!conditions || !Array.isArray(conditions)) {
        return false;
    }

    // Check each condition (any match grants voucher)
    for (const condition of conditions) {
        if (condition.type === 'simple') {
            const granted = evaluateSimpleVoucherCondition(
                response.overall_rating,
                response.would_recommend,
                condition
            );

            if (granted) return true;
        }

        if (condition.type === 'complex') {
            const granted = evaluateComplexVoucherCondition(
                response.custom_answers,
                condition
            );

            if (granted) return true;
        }
    }

    return false;
}

// ============================================
// GOOGLE REDIRECT
// ============================================

/**
 * Check if customer should be redirected to Google Reviews
 * @param {Object} response - Survey response data
 * @param {Object} googleRedirect - Google redirect configuration
 * @param {string} source - Survey source (totem, clicktotem, etc)
 * @param {string} googleReviewLink - Tenant's Google review link
 * @returns {boolean}
 */
export function shouldRedirectToGoogle(response, googleRedirect, source, googleReviewLink) {
    // Don't redirect if not enabled
    if (!googleRedirect?.enabled) {
        return false;
    }

    // Don't redirect if no Google link
    if (!googleReviewLink) {
        return false;
    }

    // NEVER redirect from totem displays (browser stays open)
    if (source === 'totem' || source === 'clicktotem') {
        return false;
    }

    // Check rating condition
    const conditions = googleRedirect.conditions || [];

    if (conditions.length === 0) {
        // No conditions = always redirect
        return true;
    }

    // Check if meets minimum rating
    const minRating = conditions[0]?.min_rating;

    if (!minRating) {
        return true;
    }

    return response.overall_rating >= minRating;
}

export function getGoogleReviewPostSubmitAction(response, googleRedirect, source, googleReviewLink) {
    if (!googleRedirect?.enabled) {
        return { mode: 'none', link: null };
    }

    if (!googleReviewLink) {
        return { mode: 'none', link: null };
    }

    const conditions = googleRedirect.conditions || [];
    const minRating = conditions[0]?.min_rating;
    const rating = response?.overall_rating;
    if (minRating && !(typeof rating === 'number' && rating >= minRating)) {
        return { mode: 'none', link: null };
    }

    if (source === 'clicktotem') {
        return { mode: 'qrcode', link: googleReviewLink };
    }

    if (source === 'totem') {
        return { mode: 'none', link: null };
    }

    return { mode: 'redirect', link: googleReviewLink };
}

// ============================================
// PLAN LIMITS
// ============================================

/**
 * Check if action is allowed based on plan limits
 * @param {Object} consumption - Current consumption data
 * @param {Object} plan - Plan with limits
 * @param {string} resourceType - 'messages' | 'surveys' | 'users'
 * @returns {Object} - { allowed, current, limit, percentage }
 */
export function checkPlanLimit(consumption, plan, resourceType) {
    const limits = {
        messages: plan?.max_messages,
        surveys: plan?.max_surveys,
        users: plan?.max_users
    };

    const currentUsage = {
        messages: consumption?.messages_sent || 0,
        surveys: consumption?.surveys_created || 0,
        users: consumption?.users_created || 0
    };

    const limit = limits[resourceType];
    const current = currentUsage[resourceType];

    // No limit = always allowed
    if (!limit) {
        return {
            allowed: true,
            current: 0,
            limit: Infinity,
            percentage: 0
        };
    }

    const percentage = (current / limit) * 100;
    const allowed = current < limit;

    return {
        allowed,
        current,
        limit,
        percentage: Math.round(percentage)
    };
}

/**
 * Get warning level based on usage percentage
 * @param {number} percentage - Usage percentage (0-100+)
 * @returns {string} - 'none' | 'warning' | 'danger' | 'exceeded'
 */
export function getLimitWarningLevel(percentage) {
    if (percentage >= 100) return 'exceeded';
    if (percentage >= 90) return 'danger';
    if (percentage >= 80) return 'warning';
    return 'none';
}

// ============================================
// UTILITIES
// ============================================

/**
 * Generate unique voucher code
 * @returns {string}
 */
export function generateVoucherCode() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 11).toUpperCase();
    return `VOUCHER-${timestamp}-${random}`;
}

/**
 * Format voucher for display
 * @param {Object} voucher - Voucher object
 * @returns {string}
 */
export function formatVoucherDiscount(voucher) {
    if (!voucher) return '';

    switch (voucher.type) {
        case 'discount_percentage':
            return `${voucher.discount_percentage}% OFF`;
        case 'discount_fixed':
            return `R$ ${voucher.discount_fixed.toFixed(2)} OFF`;
        case 'gift':
            return 'BRINDE GRÁTIS';
        case 'free_shipping':
            return 'FRETE GRÁTIS';
        default:
            return voucher.name;
    }
}
