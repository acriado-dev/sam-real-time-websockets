import AWS from 'aws-sdk';
import {StatusCodes} from 'http-status-codes';
import {validateRequiredEnvVars} from "../util/Environment.mjs";

const ddb = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: process.env.AWS_REGION });

/**
 * Default ondisconnect handler. Corresponds to the ondisconnect route in the API Gateway definition.
 * @param event
 * @returns {Promise<{body: string, statusCode: number}>}
 */
export const handler = async event => {

  console.log('Received event:', JSON.stringify(event, null, 2));
  validateRequiredEnvVars('TABLE_NAME');

  const deleteParams = {
    TableName: process.env.TABLE_NAME,
    Key: {
      connectionId: event.requestContext.connectionId
    }
  };

  try {
    await ddb.delete(deleteParams).promise();
  } catch (err) {
    console.error(`Failed to disconnect: ${err}`);
    return { statusCode: StatusCodes.INTERNAL_SERVER_ERROR, body: `Failed to disconnect: ${err}` };
  }

  return { statusCode: StatusCodes.OK, body: 'Disconnected.' };
};