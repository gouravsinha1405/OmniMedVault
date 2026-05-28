import { APIGatewayProxyEventV2, Context, Handler } from 'aws-lambda';
import serverlessExpress from '@codegenie/serverless-express';
import express from 'express';

import { createApp } from './app.factory';

let cachedHandler: Handler;

async function getHandler(): Promise<Handler> {
  if (cachedHandler) {
    return cachedHandler;
  }

  const expressApp = express();
  await createApp(expressApp);

  cachedHandler = serverlessExpress({ app: expressApp });
  return cachedHandler;
}

export const handler: Handler = async (
  event: APIGatewayProxyEventV2,
  context: Context,
  callback,
) => {
  const lambdaHandler = await getHandler();
  return lambdaHandler(event, context, callback);
};
