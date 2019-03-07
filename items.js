const AWS = require('aws-sdk');
const Path = require('path')

module.exports.handler = function (event, context, callback) {
    const itemsTable = process.env.ITEMS_TABLE;

    const inputBucketName = event.Records[0].s3.bucket.name;
    const filename = '/' + decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));

    const path = Path.parse(filename)
    const itemParent = path.dir === '/' ? '/' : path.dir + '/';
    
    const dynamo = new AWS.DynamoDB.DocumentClient();
    
    let parent = path.dir + '/';

    console.log({ state: "items start", filename: filename, itemParent: itemParent, parent: parent, path: path });

    let n = 6;
    while (parent && parent != '/') {
        const paths = parent.split(Path.sep);
        console.log({paths: paths})
        paths.pop();
        paths.pop();
        const grandParent = paths.join('/') + '/';
        const parentObject = {
            path: parent,
            parent: grandParent,
            type: "folder",
            private: false
        };

        const params = {
            TableName: itemsTable,
            Item: parentObject,
            ConditionExpression: "attribute_not_exists(parent)"
        };

        console.log({ state: "parent item creation", parent: parent, grandParent : grandParent, params: params });

        dynamo.put(params, function (err, data) {
            if (!err) {
                console.log({ state: "parent item created succesfully", data: data });
            } else if (err.code === 'ConditionalCheckFailedException') {
                console.log({ state: "parent item creation skipped, already exists", data: data });
            } else {
                console.error({ state: "parent item creation error", error: err });
            }
        });
        parent = grandParent;
        n = n -1;
        if (n < 0) break;
    }

    const itemObject = {
        path: filename,
        parent: itemParent,
        type: "image",
        private: false
    };

    const params = {
        TableName: itemsTable,
        Item: itemObject,
        ConditionExpression: "attribute_not_exists(parent)"
    };

    console.log({ state: "item creation", params: params })

    dynamo.put(params, function (err, data) {
        if (!err) {
            console.log({ state: "item created succesfully", data: data });
        } else if (err.code === 'ConditionalCheckFailedException') {
            console.log({ state: "item creation skipped, already exists", data: data });
        } else {
            console.error({ state: "item creation error", error: err });
        }
    });
}