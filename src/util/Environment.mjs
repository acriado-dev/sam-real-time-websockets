import {StatusCodes} from "http-status-codes";

/**
 * Validates that the required environment variables received as arguments are set.
 * @param varNames
 * @returns {{body: string, statusCode: StatusCodes.INTERNAL_SERVER_ERROR}}
 */
export function validateRequiredEnvVars(...varNames) {
    for (let varName of varNames) {
        if (!process.env[varName]) {
            let errorMessage = `${varName} environment variable is not set`;
            console.error(errorMessage);
            return { statusCode: StatusCodes.INTERNAL_SERVER_ERROR, body: errorMessage };
        }
    }
}