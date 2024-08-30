const express = require('express');
const app = express();
const port = 3000;

// 198.54.120.245:443
// 198.54.120.245 
app.listen(port, () => console.log(`Server has started on port: ${port}`));

// This is the Gemini part
// once the above app.post sends successfully 
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI('AIzaSyBsQe9jWhtqx9Xgw0TNfipo2pErGpBp-vc');

const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    // Set the `responseMimeType` to output JSON
    generationConfig: { responseMimeType: "application/json" }
});

/*app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  // res.header("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS,POST,PUT");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  next();
  // res.end();
});*/

/*app.all('*', function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if ('OPTIONS' == req.method) {
  res.sendStatus(200);
  } else {
    next();
  }
});*/

// app.use(express.static('public'));
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Test World!')
});

// TESTING SENDING TO BROWSER
app.post('/', async (req, res) => {
  // res.status(200).send({status:'received 2'});
  console.log('req.body', req.body) 
  const { payload } = req.body;
  console.log('payload', payload);
  if (!payload) {
      return res.status(400).send({ status: 'failed 2' });
  }
  // res.status(200).send({status: 'received'});

  /*const result = await model.generateContent(payload);
  const response = await result.response;
  const text = await response.text();
  const obj = { info: text };
  
  res.status(200).json(obj);
  */

  const geminiRes = await run(payload);
  res.status(200).json(geminiRes);

  res.send({status:'success!'});
});

// This the function that triggers Gemini with the prompt 
// Then gets the result
// & sends back to browser
async function run(prompt) {
    const result = await model.generateContent(prompt);
    const response = await result.response;

    const text = response.text();

    //console.log('\n\n');
    //console.log(text);

    return response.text();
}


























/*app.get('/info', async (req, res) => {
    const prompt = 'Create a 1 day plan for NYC that includes Central Park, and restaurants';
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = await response.text();
    const obj = { info: text };
    
    res.status(200).json(obj);
});*/

/*
app.route('/prompt-gemini/try2.html')
  .get((req, res) => {
    res.send('Get a test book')
  })
  .post((req, res) => {
    res.json({status:'Add another test book you guy'})
  })
  .put((req, res) => {
    res.send('Update the book')
  })
  */

/*app.post('/test/try.html', async (req, res) => {
    res.status(200).send({status:'received 2'});
});*/

/*app.post('/', (req, res) => {
    res.send('Got a POST request')
})* /

app.post('/test', async (req, res) => {
    /*console.log('req.body', req.body)
    const { payload } = req.body;
    console.log('payload', payload);
    if (!payload) {
        return res.status(400).send({ status: 'failed' });
    }*/
    // res.status(200).send({status: 'received'});

    /*const result = await model.generateContent(payload);
    const response = await result.response;
    const text = await response.text();
    const obj = { info: text };
    
    res.status(200).json(obj);
    * /

    res.send({status:'post received test'});
});

app.listen(port, () => console.log(`Server has started on port: ${port}`));
*/





















/*
const express = require("express");
const needle = require("needle");
const app = express();
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

needle.get("https://askkhonsu-com-b7537072c076b7af0bbe93c4e.webflow.io/", function(error, response) {
  // console.log('error', error)
  // console.log('response', response.statusCode)
  // if (!error && response.statusCode == 200)
    // console.log(response.body);
});

app.get("/", async (req, res) => {
  try {
    const response = await needle(
      "get",
      "https://askkhonsu-com-b7537072c076b7af0bbe93c4e.webflow.io/",
      // "https://jsonplaceholder.typicode.com/posts"
    );
    console.log(response.body);
    //res.json(response.body);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  }
});
*/

/*var needle = require('needle');

var options = {
  headers: { 'X-Custom-Header': 'Bumbaway atuna' }
}

var data = {
  myfile: 'yes',
  content_type: 'text/HTML'
};*/

/*needle.get('https://www.askkhonsu.com/', function(error, response) {
  console.log('error', error)
  console.log('response', response.statusCode)
  if (!error && response.statusCode == 200)
    console.log(response.body);
});*/

/*var options = {
  compressed: true,
  accept: 'application/json',
  content_type: 'application/json'
};

needle.post('https://askkhonsu-com-b7537072c076b7af0bbe93c4e.webflow.io/', data, options, function(err, resp, body) {
  // you can pass params as a string or as an object.
    console.log(body.toString());
});
*/
/*needle
  .post('https://askkhonsu-com-b7537072c076b7af0bbe93c4e.webflow.io/', data, { json: true })
  .on('readable', function() { 
    console.log('Done! Part 2')
  })
  .on('done', function(err) {
    console.log('Ready-o!');
})*/


/*var http = require('http');

var options = {
  host: 'https://themuno.github.io',
  port: 3000,
  path: '/prompt-gemini',
  method: 'POST'
};

var req = http.request(options, function(res) {
  console.log('STATUS: ' + res.statusCode);
  console.log('HEADERS: ' + JSON.stringify(res.headers));
  res.setEncoding('utf8');
  res.on('data', function (chunk) {
    console.log('BODY: ' + chunk);
  });
});

req.on('error', function(e) {
  console.log('problem with request: ' + e.message);
});

// write data to request body
req.write('data\n');
req.write('data\n');
req.end();
*/
