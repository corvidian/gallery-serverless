const AWS = require('aws-sdk');
const async = require('async');
const gm = require('gm').subClass({ imageMagick: true }); // Enable ImageMagick integration.
const items = require('./items');

module.exports.handler = function (event, context, callback) {

    if (event.Records) {
        const inputBucketName = event.Records[0].s3.bucket.name;
        const outputBucketName = process.env.THUMB_BUCKET;
        const filename = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));
        
        // constants
        const MAX_WIDTH = 300;
        const MAX_HEIGHT = 300;

        const outputKey = MAX_WIDTH + '/' + filename;

        console.log("inputBucketName: ", inputBucketName);
        console.log("outputBucketName: ", outputBucketName);
        console.log("filename: ", filename);


        // Infer the image type.
        const typeMatch = filename.match(/\.([^.]*)$/);
        if (!typeMatch) {
            callback("Could not determine the image type.");
            return;
        }
        const imageType = typeMatch[1];
        if (imageType != "jpg" && imageType != "png") {
            callback('Unsupported image type: ${imageType}');
            return;
        }

        items.handler(event, context);

        const s3 = new AWS.S3();

        // Download the image from S3, transform, and upload to a different S3 bucket.
        async.waterfall([
            function download(next) {
                // Download the image from S3 into a buffer.
                s3.getObject(
                    {
                        Bucket: inputBucketName,
                        Key: filename
                    },
                    next
                );
            },
            function transform(response, next) {
                gm(response.Body).size(function (err, size) {
                    // Infer the scaling factor to avoid stretching the image unnaturally.
                    const scalingFactor = Math.min(
                        MAX_WIDTH / size.width,
                        MAX_HEIGHT / size.height
                    );
                    const width = scalingFactor * size.width;
                    const height = scalingFactor * size.height;

                    // Transform the image buffer in memory.
                    this.resize(width, height)
                        .toBuffer(imageType, function (err, buffer) {
                            if (err) {
                                next(err);
                            } else {
                                next(null, response.ContentType, buffer);
                            }
                        });
                });
            },
            function upload(contentType, data, next) {
                // Stream the transformed image to a different S3 bucket.
                s3.putObject({
                    Bucket: outputBucketName,
                    Key: outputKey,
                    Body: data,
                    ContentType: contentType
                },
                    next);
            }
        ], function (err) {
            if (err) {
                console.error(
                    'Unable to resize ' + inputBucketName + '/' + filename +
                    ' and upload to ' + outputBucketName + '/' + outputKey +
                    ' due to an error: ' + err
                );
            } else {
                console.log(
                    'Successfully resized ' + inputBucketName + '/' + filename +
                    ' and uploaded to ' + outputBucketName + '/' + outputKey
                );
            }

            callback(null, "message");
        }
        );

        /*
                async.waterfall([
                    Lib.download.bind(this, s3, inputBucketName, filename),
                    Lib.unzipZip,
                    Lib.readManifestFile,
                    Lib.createPdf,
                    Lib.upload.bind(this, s3, outputBucketName, filename)
                ], function(err) {
                    if (err) {
                        console.error(err)
                    }
                    else {
                        console.log("Success!");
                    }
                    callback(null, "message");
                });
            */
    }
};