import AWS from 'aws-sdk';
import {StatusCodes} from 'http-status-codes';
import {validateRequiredEnvVars} from "../util/Environment.mjs";


const ddb = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: process.env.AWS_REGION });

const { TABLE_NAME } = process.env;

//TODO - replace vehicle for real time data

/**
 *  Gets all connections for real time items and sends the event to each connection.
 * @param connections Websocket connections - connectionId, vehicleId
 * @param api ApiGatewayManagementApi - used to send data to websocket connections
 * @param event - DynamoDB streams event
 * @returns {*}
 */
function processRealTimeItemConnections(connections, api, event) {
    const realTimeItemKey = process.env.REAL_TIME_ITEM_KEY;

    if(!event.Records[0].dynamodb.NewImage[realTimeItemKey]) {
        console.error(`No real time item ${realTimeItemKey} found in the event`);
        return;
    }

    console.log('event.Records[0].dynamodb.NewImage[realTimeItemKey] --> ' + JSON.stringify(event.Records[0].dynamodb.NewImage[realTimeItemKey]));
    const realTimeItemId = event.Records[0].dynamodb.NewImage[realTimeItemKey].S;
    console.log('realTimeItemId --> ' + realTimeItemId);
    console.log(JSON.stringify(connections.Items));
    const relevantConnections = connections.Items.filter(item => (item.realTimeItemId === realTimeItemId  && item.realTimeItemKey === realTimeItemKey));
    console.log('relevantConnections --> ' + JSON.stringify(relevantConnections));


    return relevantConnections.map(async ({connectionId}) => {
        try {
            console.log(`Sending data to ${connectionId}`);
            await api.postToConnection({
                ConnectionId: connectionId,
                Data: JSON.stringify(event.Records[0].dynamodb.NewImage)
            }).promise();
        } catch (e) {
            if (e.statusCode === StatusCodes.GONE) {
                console.log(`Found stale connection, deleting ${connectionId}`);
                await ddb.delete({TableName: TABLE_NAME, Key: {realTimeItemId}}).promise();
            } else {
                console.error(e);
                throw e;
            }
        }
    });
}

/**
 * Default onreceiveitem handler. Corresponds to the onreceiveitem route in the API Gateway definition.
 * This function is triggered when a new item is added or modified to the DynamoDB table 'RealTimeData'
 * @param event
 * @returns {Promise<{body: object | Error | string, statusCode: StatusCodes.INTERNAL_SERVER_ERROR}|{body: string, statusCode: StatusCodes.OK}>}
 */
export const handler = async event => {

    let connections;

    console.log('Received event:', JSON.stringify(event, null, 2));
    validateRequiredEnvVars('TABLE_NAME', 'WS_ENDPOINT', 'REAL_TIME_ITEM_KEY');

    try {
        connections = await ddb.scan({ TableName: TABLE_NAME, ProjectionExpression: 'connectionId, realTimeItemId, realTimeItemKey' }).promise();
    } catch (e) {
        return { statusCode: StatusCodes.INTERNAL_SERVER_ERROR, body: e.stack };
    }

    const api = new AWS.ApiGatewayManagementApi({
        apiVersion: '2018-11-29',
        endpoint: process.env.WS_ENDPOINT,
    });


    const postCalls = processRealTimeItemConnections(connections, api, event);

    if(!postCalls || postCalls.length === 0) {
        return { statusCode: StatusCodes.OK, body: 'No connections found.' };
    } else {
        try {
            await Promise.all(postCalls);
        } catch (e) {
            return {statusCode: StatusCodes.INTERNAL_SERVER_ERROR, body: e.stack};
        }
    }

    return { statusCode: StatusCodes.OK, body: ' Real time event sent.' };

}