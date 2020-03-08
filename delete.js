const AWS = require('aws-sdk');
const async = require('async');
const Path = require('path')

module.exports.handler = function (event, context, callback) {

    if (event.Records) {
        const itemsTable = process.env.ITEMS_TABLE;
         const inputBucketName = event.Records[0].s3.bucket.name;
        const thumbBucket = process.env.THUMB_BUCKET;
        const filename = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));

        // constants
        const MAX_WIDTH = 300;

        const outputKey = MAX_WIDTH + '/' + filename;

        console.log("inputBucketName: ", inputBucketName);
        console.log("thumbBucket: ", thumbBucket);
        console.log("filename: ", filename);

        const s3 = new AWS.S3();
        const dynamo = new AWS.DynamoDB.DocumentClient();

        async.waterfall([
            function removeItem(next) {
                const path = filename ? Path.parse(filename) : '/'
                console.log("path: ", path);
                const params = {
                    TableName: itemsTable,
                    Key: {
                        parent: path.dir ? path.dir : '/',
                        path: filename
                    }
                };
                console.log("dynamo params: ", params);
                console.log("dynamo next: ", next);
                dynamo.delete(params, next);
            }, 
            function deleteThumb(response, next) {
                const params = {
                    Bucket: thumbBucket,
                    Key: outputKey
                };

                console.log("s3 response: ", response);
                console.log("s3 params: ", params);
                console.log("s3 next: ", next);
                s3.deleteObject(params, next);
            }
        ], function (err) {
            if (err) {
                console.error(
                    'Unable to delete ' + outputKey +
                    ' due to an error: ' + err
                );
            } else {
                console.log(
                    'Successfully resized ' + inputBucketName + '/' + filename +
                    ' and uploaded to ' + thumbBucket + '/' + outputKey
                );
            }
        });
    }
}
