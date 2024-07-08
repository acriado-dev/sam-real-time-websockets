import AWS from 'aws-sdk';
import { StatusCodes } from 'http-status-codes';
import {validateRequiredEnvVars} from "../util/Environment.mjs";

const ddb = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: process.env.AWS_REGION });

const DEAFULT_TTL = parseInt((Date.now() / 1000) + 3600); //1h
/**
 * Default Websocket onconnect handler. Corresponds to the onconnect route in the API Gateway definition.
 * @param event - Websocket connection event
 * @returns {Promise<{body: string, statusCode: number}>}
 */
export const handler = async event => {

  console.log('Received event:', JSON.stringify(event, null, 2));
  validateRequiredEnvVars('TABLE_NAME', 'REAL_TIME_ITEM_KEY', 'IS_QUERY_PARAM');

  let realTimeItemId;
  const isQueryParam = process.env.IS_QUERY_PARAM;
  const realTimeItemKey = process.env.REAL_TIME_ITEM_KEY;

  if (isQueryParam === 'true') {
    if (!event.queryStringParameters) {
        console.error('No query string parameters found');
        return { statusCode: StatusCodes.BAD_REQUEST, body: 'No query string parameters found' };
    }else if (!event.queryStringParameters[realTimeItemKey]) {
        console.error(`No ${realTimeItemKey} found`);
        return { statusCode: StatusCodes.BAD_REQUEST, body: `No queryStringParam for real time item key ${realTimeItemKey} found` };
    } else {
      realTimeItemId = event.queryStringParameters[realTimeItemKey];
    }
  } else { // header
    if (!event.headers) {
        console.error('No headers found');
        return { statusCode: StatusCodes.BAD_REQUEST, body: 'No headers found' };
    } else if (!event.headers[realTimeItemKey]) {
        console.error(`No ${realTimeItemKey} found`);
        return { statusCode: StatusCodes.BAD_REQUEST, body: `No header for real time item key ${realTimeItemKey} found` };
    } else {
      realTimeItemId = event.headers[realTimeItemKey];
    }
  }

  const connectionId = event.requestContext.connectionId;
  const putParams = {
    TableName: process.env.TABLE_NAME,
    Item: {
      connectionId: connectionId,
      realTimeItemId: realTimeItemId,
      realTimeItemKey: realTimeItemKey,
      ttl:  DEAFULT_TTL
    }
  };

  try {
    console.log(`Attempting to put item: ${putParams.Item.connectionId}`);
    await ddb.put(putParams).promise();
  } catch (err) {
    console.error(`Failed to put item: ${err}`);
    return { statusCode: StatusCodes.INTERNAL_SERVER_ERROR, body: `Failed to put item: ${err}` };
  }

  console.info(`Successfully connected ${connectionId}.`);
  return { statusCode: StatusCodes.OK, body: 'Connected.' };
};