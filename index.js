const serverless = require('serverless-http');
const bodyParser = require('body-parser');
const express = require('express')
const app = express()
const AWS = require('aws-sdk');
const Path = require('path');

const USERS_TABLE = process.env.USERS_TABLE;
const IMAGE_BUCKET = process.env.IMAGE_BUCKET;
const THUMB_BUCKET = process.env.THUMB_BUCKET;
const dynamoDb = new AWS.DynamoDB.DocumentClient();

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
})

app.get('/gallery/:path(*)', function (req, res) {
  const path = decodeURI(req.params['path']).replace(/\+/g, ' ')

  var params = {
    Bucket: IMAGE_BUCKET,
    Delimiter: '/',
    Prefix: path
  };

  const s3 = new AWS.S3();

  s3.listObjects(params, function (err, data) {
    if (err) {
      res.status(404).json({
        error: "Not found",
        err: err,
        data: data,
        path: path
      });
    } else {
      const files = data["Contents"].map((file) => (
        {
          type: 'image',
          name: Path.basename(file["Key"]),
          path: file["Key"],
          thumbnail: s3.getSignedUrl('getObject', { Bucket: THUMB_BUCKET, Key: '300/' + file["Key"], Expires: 60 * 5}),
          download: s3.getSignedUrl('getObject', { Bucket: IMAGE_BUCKET, Key: file["Key"], Expires: 60 * 15}),
        }
      ))

      const directories = data["CommonPrefixes"].map((dir) => (
        {
          type: 'folder',
          name: Path.basename(dir["Prefix"]),
          path: dir["Prefix"]
        }
      ))

      res.json({
        path: path,
        objects: directories.concat(files),
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
