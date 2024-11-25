const express = require('express');
const app = express();
const port = 3000;

app.listen(port, () => console.log(`Server has started on port: ${port}`));

// init gemini api
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI('AIzaSyBsQe9jWhtqx9Xgw0TNfipo2pErGpBp-vc');

app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  // res.header('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS,POST,PUT');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
  // res.end();
});

app.use(express.static('public')); // localhost
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Test World!')
});

app.post('/', async (req, res) => {  
  const { payload, tryOut } = req.body;

  // console.log('payload', payload);
  // console.log('tryOut', tryOut);

  if (!payload) {
      return res.status(400).send({ status: 'failed' });
  }

  const geminiRes = await promptGemini(payload, tryOut);

  if (tryOut) {
    res.status(200).send(geminiRes);
  }
  else {
    res.status(200).json(geminiRes);
  }
  
});

// trigger gemini with the prompt 
async function promptGemini(prompt, tryOut=false) {
    const modelObj = { model: 'gemini-1.5-flash' };
    // const modelObj = { model: 'gemini-1.5-pro' };
    // const modelObj = { model: 'gemini-1.5-flash-8b' };

    if (!tryOut) modelObj.generationConfig = { responseMimeType: 'application/json' };

    /*const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        // Set the `responseMimeType` to output JSON
        generationConfig: { responseMimeType: 'application/json' }
    });*/

    const model = genAI.getGenerativeModel(modelObj);

    const result = await model.generateContent(prompt);
    const response = await result.response;

    console.log('usage_metadata:::', result.usage_metadata);

    return response.text();
}
