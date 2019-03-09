const serverless = require('serverless-http');
const bodyParser = require('body-parser');
const express = require('express')
const app = express()
const AWS = require('aws-sdk');
const Path = require('path');
var cors = require('cors')

const USERS_TABLE = process.env.USERS_TABLE;
const ITEMS_TABLE = process.env.ITEMS_TABLE;
const IMAGE_BUCKET = process.env.IMAGE_BUCKET;
const THUMB_BUCKET = process.env.THUMB_BUCKET;

app.use(cors());
app.use(bodyParser.json({ strict: false }));

app.get('/', function (req, res) {
  res.send('Hello World!')
})

// Get User endpoint
app.get('/users/:userId', function (req, res) {
  const params = {
    TableName: USERS_TABLE,
    Key: {
      userId: req.params.userId,
    },
  }

  dynamoDb.get(params, (error, result) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: 'Could not get user' });
    }
    if (result.Item) {
      const { userId, name } = result.Item;
      res.json({ userId, name });
    } else {
      res.status(404).json({ error: "User not found" });
    }
  });
});

app.get('/gallery/:path(*)', function (req, res) {
  console.log({ params: req.params });

  const path = decodeURI(req.params['path']).replace(/\+/g, ' ')

  const params = {
    TableName: ITEMS_TABLE,
    KeyConditionExpression: "#par = :parent",
    ExpressionAttributeNames: {
      "#par": "parent"
    },
    ExpressionAttributeValues: {
      ":parent": path ? path : '/'
    }
  };

  const dynamoDb = new AWS.DynamoDB.DocumentClient();
  const s3 = new AWS.S3();
  
  dynamoDb.query(params, function (err, data) {
    if (err) {
      console.error({ state: "dynDb list", error: err, params: params });
      res.status(500).json({
        error: "DynamoDb error",
        err: err,
        data: data,
        path: path
      });
    } else {
      console.log({ state: "dynDb list", data: data, params: params });

      const items = [];

      data.Items
        .filter(item => !item.private)
        .forEach(function (item) {
          console.log({ item: item });
          var itemData;
          if (item.type === 'image') {
            itemData = {
              type: 'image',
              name: Path.basename(item.path),
              path: item.path,
              thumbnail: s3.getSignedUrl('getObject', { Bucket: THUMB_BUCKET, Key: '300/' + item.path, Expires: 60 * 5 }),
              download: s3.getSignedUrl('getObject', { Bucket: IMAGE_BUCKET, Key: item.path, Expires: 60 * 15 }),
            }
          } else {
            itemData = {
              type: 'folder',
              name: Path.basename(item.path),
              path: item.path
            }
          }
          console.log({ itemData: itemData });
          items.push(itemData);
        });

      res.json({
        path: path,
        objects: items,
      });
    }
  });
});

// Create User endpoint
app.post('/users', function (req, res) {
  const { userId, name } = req.body;
  if (typeof userId !== 'string') {
    res.status(400).json({ error: '"userId" must be a string' });
  } else if (typeof name !== 'string') {
    res.status(400).json({ error: '"name" must be a string' });
  }

  const params = {
    TableName: USERS_TABLE,
    Item: {
      userId: userId,
      name: name,
    },
  };

  dynamoDb.put(params, (error) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: 'Could not create user' });
    }
    res.json({ userId, name });
  });
})

module.exports.handler = serverless(app);
