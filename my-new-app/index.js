// from official Google docs.
const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const {authenticate} = require('@google-cloud/local-auth');
const {google} = require('googleapis');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://mail.google.com/'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');
console.log(TOKEN_PATH , "    ", CREDENTIALS_PATH);

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file comptible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

/**
 * Lists the labels in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function listLabels(auth) {
    const gmail = google.gmail({version: 'v1', auth});
    // Listing all unread messages!! 
    const res = await gmail.users.messages.list({
      userId: 'me', // my email
      q: 'is:unread', // querying only unread message
      maxResults: 1, // max mail to return
      format: 'full'
    });
    console.log(res, "   +++++++++++++++++++++++++++++   ");
    const labels = res.data.messages;
    if (!labels || labels.length === 0) {
      console.log('No labels found.');
      return;
    }
    
    console.log('Messages:');
    
    const save = [];
    labels.forEach(async (label) => {
        console.log(`-${JSON.stringify(label)}`, " !!!!!!!!!!END!!!!!!!!!!!");

        // Check if message has any threads or not!!
        const response = await gmail.users.threads.list({
          auth: auth,
          userId: 'me',
          q: `rfc822msgid:${label.id}`,
        });
    
        const threads = response.data.threads;
        if (threads && threads.length > 0) {
          console.log(`Message with Message-ID ${label.id} has threads.`);
        } else {
          console.log(`Message with Message-ID ${label.id} does not have any threads.`);
          save.push(label.id);

          // Getting details of each message.
          const message = await gmail.users.messages.get({
            auth: auth,
            userId: 'me',
            id: label.id,
            format: 'full'
          });

          const originalMessage = message.data;
          console.log("Original Message here!!!  ",originalMessage.payload.headers);
          
          const replyBody = 'I am currently unavailable.';

          const replySubject = `Re: ${originalMessage.payload.headers.find(h => h.name === 'Subject').value}`;
          const replyTo =  `${originalMessage.payload.headers.find(h => h.name === 'From').value}`;
          const replyMessageParts = [
            `From: <khannasiddhant22@gmail.com>`, // Set the email address you want to use as the sender
            `To: ${replyTo}`,
            `Subject: ${replySubject}`,
            `In-Reply-To: ${originalMessage.payload.headers.find(h => h.name === 'Message-ID').value}`,
            `References: ${originalMessage.payload.headers.find(h => h.name === 'Message-ID').value}`,
            'Content-Type: text/plain; charset=utf-8',
            '',
            replyBody
          ];

          const replyMessageRaw = Buffer.from(replyMessageParts.join('\n'))
                                  .toString('base64')
                                  .replace(/\+/g, '-')
                                  .replace(/\//g, '_')
                                  .replace(/=+$/, '');

          const reply = await gmail.users.messages.send({
            auth: auth,
            userId: 'me',
            requestBody: {
              raw: replyMessageRaw
            },
          });

          console.log('Reply sent:', reply.data);

          // Adding Labels!!!!
          await gmail.users.messages.modify({
            userId: 'me',
            id : `${reply.data.id}`,
            resource:{
              addLabelIds: ['UNREAD']
            }
          },(err, res)=>{
            if(err)console.log(err);
            else console.log(res);
          })
        }
    }), (error)=>{
      if(error)console.log('Error detected ',err);
      
    };
       
    // setTimeout(listLabels,50000)// after 50 sec again invoke the function
    }

authorize().then(listLabels).catch(console.error);


