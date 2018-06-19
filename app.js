const http = require('http');
const https = require('https');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();

app.use(bodyParser.json());

const tealium_account = 'beckershealthcare';
const tealium_profile = 'main';
const email_prefix = '__beckershealthcare_main__5002_';
const email_suffix = '__';
const hub_prefix = '__beckershealthcare_main__5450_';
const cc_api_key = 'hptvtapen5dyy6zvx6r3bhcf';
const cc_bearer = '5fab2855-ccbf-4311-9f60-70af61082260';

// Functions -------------
function cc_get_contact_id(email) {
  return new Promise(function(resolve, reject) {
    // resolve(1);
    try {
      let cc1_options = {
        host: 'api.constantcontact.com',
        path: `/v2/contacts?status=ALL&limit=50&api_key=${cc_api_key}&email=${email}`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cc_bearer}`
        }
      };

      let cc1_req = https.request(cc1_options, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          console.log("CC Respond Body", body);
          let parsedBody = JSON.parse(body);
          let cc_id = parsedBody.results[0].id;
          resolve(cc_id);
        });
      });
      cc1_req.end();
    } catch (e) {
      reject(e);
    }
  })
};

function cc_get_stats(cc_id) {
  return new Promise(function(resolve, reject) {
    // resolve(2);
    try {
      let cc2_options = {
        host: 'api.constantcontact.com',
        path: `/v2/contacts/${cc_id}/tracking/reports/summary?api_key=${cc_api_key}`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cc_bearer}`
        }
      };
      let cc2_req = https.request(cc2_options, (res) => {
        let body2 = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body2 += chunk;
        });
        res.on('end', () => {
          console.log(`CC Stats: ${body2}`);
          let parsedBody2 = JSON.parse(body2);
          resolve(parsedBody2);
        }).on('error', (e) => reject(e))
      });
      cc2_req.end();
    } catch (e) {
      reject(e);
    }
  })
};

function post_to_tealium(data) {
  try {
    let post_options = {
      host: 'collect.tealiumiq.com',
      port: '80',
      path: '/event',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    let post_req = http.request(post_options, (res) => {
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        console.log(`Response: ${chunk}`);
      });
      res.on('end', () => {
        console.log('post_to_tealium done!')
      });
    });
    console.log("line 83, log within post_to_tealium", data);
    post_req.write(JSON.stringify(data));
    post_req.end();
  } catch (e) {
    console.log(e);
  }
};

// Application ------------

app.post('/cc', (req, res) => {
  console.log('line 92 cons log req.body', req.body);
  console.log('line 93 cons log req.body.email', req.body.email);
  // console.log("event", event);
  // console.log("event.body", event.body);
  // console.log("req", req);
  let email_address = req.body.email;
  console.log('line 98 email_address', email_address);
  cc_get_contact_id(email_address).then(function(cc_id) {
    return cc_get_stats(cc_id).then(function(parsedBody2) {
      let tealData = Object.assign({}, parsedBody2);
      // console.log('line 101, resolve', body2);
      // let tealData = JSON.parse(JSON.stringify(body2));
      //console.log('103 tealData', tealData);
      tealData['tealium_account'] = tealium_account;
      tealData['tealium_profile'] = tealium_profile;
      tealData['tealium_visitor_id'] = `${email_prefix}${email_address}`;
      tealData['email'] = email_address;
      tealData['tealium_event'] = 'Constant Contact';
      tealData['tealium_datasource'] = '8gqgwq';
      console.log('109 tealData', tealData);
      return post_to_tealium(tealData);
    })
  }).catch(function(e) {
    console.log(e)
  })
});

app.post('/hubspot', (req, res) => {
  console.log("117 cons log req.body", req.body);
  // res.send("res.send(event)", event);
  if (req.body === undefined) {
    res.status(400).send('No message defined!');
  } else {
    console.log('124 Inbound Hubspot Request:', req.body);
    res.status(200).send('Success: ' + req.body);
    let data = parsePostData(req);
    console.log("127 data", data);
    post_to_tealium(data);
  }

  function parsePostData(req) {
    let email_value = req.body.properties.email.value;
    try {
      let postData = {};
      postData.tealium_account = tealium_account;
      postData.tealium_profile = tealium_profile;
      postData.tealium_event = 'Hubspot';
      postData.tealium_datasource = 'mq7gg5';
      // postData.tealium_trace_id = '04072';
      postData.tealium_visitor_id = `${email_prefix}${email_value}${email_suffix}`;
      postData.email = req.body.properties.email.value;
      postData.hubspot_id = req.body['profile-token'];
      postData.first_name = req.body.properties.firstname.value;
      postData.last_name = req.body.properties.lastname.value;
      postData.organization = req.body.properties.company.value;
      postData.phone = req.body.properties.phone.value;
      postData.hospital_employee = req.body.properties.are_you_employed_by_a_hospital_health_system_or_other_medical_facility_.value;
      postData.last_submission = req.body['form-submissions'][0]['page-title'];
      postData.submission_title = req.body['form-submissions'][0]['title'];
      postData.enl_bhr_subscriber = req.body.properties.enl_bhr_subscriber.value;
      postData.enl_subscriber_via_tealium = req.body.properties.enl_subscriber_via_tealium.value;
      return postData;
    } catch (e) {
      console.log(e);
    }
  }
});

//app.get('/', (req, res) => res.send('Hello world!'));

// Export your Express configuration so that it can be consumed by the Lambda handler
module.exports = app;
