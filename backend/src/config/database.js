import mongoose from "mongoose";

process.env.MONGODB_URI ??= "mongodb://happywizard0830_db_user:yQcc3WecTqz14L1w@ac-wf3w7z9-shard-00-00.paftlaf.mongodb.net:27017,ac-wf3w7z9-shard-00-01.paftlaf.mongodb.net:27017,ac-wf3w7z9-shard-00-02.paftlaf.mongodb.net:27017/?ssl=true&replicaSet=atlas-3rfmgn-shard-0&authSource=admin&appName=Cluster0";
process.env.MONGODB_DB_NAME ??= "flightBookingDB";

const maximumConnectionAttempts = 3;

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function isRetryableConnectionError(error) {
  return (
    error?.errorLabelSet?.has("RetryableError") ||
    ["MongoNetworkError", "MongoServerSelectionError"].includes(error?.name)
  );
}

export async function connectDatabase(uri = process.env.MONGODB_URI) {
  if (!uri) {
    throw new Error("MONGODB_URI is not configured");
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  for (let attempt = 1; attempt <= maximumConnectionAttempts; attempt += 1) {
    try {
      await mongoose.connect(uri, {
        dbName: process.env.MONGODB_DB_NAME || "flightBookingDB",
        autoIndex: process.env.NODE_ENV !== "production",
        maxPoolSize: 5,
        maxConnecting: 1,
      });
      return mongoose.connection;
    } catch (error) {
      const canRetry =
        attempt < maximumConnectionAttempts && isRetryableConnectionError(error);

      if (!canRetry) {
        throw error;
      }

      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
      await delay(attempt * 1000);
    }
  }

  return mongoose.connection;
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
