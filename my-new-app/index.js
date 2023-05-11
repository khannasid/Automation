// from official Google docs.
const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const {authenticate} = require('@google-cloud/local-auth');
const {google} = require('googleapis');
const { log } = require('console');

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
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: 'is:unread'
  });
  const labels = res.data.messages;
  if (!labels || labels.length === 0) {
    console.log('No labels found.');
    return;
  }
  console.log('Messages:');
  const save = [];
  labels.forEach((label) => {
      console.log(`-${label.id}`);
      save.push(label.id);
  });

    console.log("HELLOOooooooooooooooooo");
    console.log("Gmailllllllllllllllll");
    save.forEach(async(id)=>{

        await gmail.users.messages.get({
            userId: 'me',
            id: id,
            format: 'full'
        }, async (err, res) => {
            if (err) return console.log('The API returned an error: ' + err);
            
            console.log("-------------->>>>>> ",res);

            const threadId = res.data.threadId;
            const threads = await gmail.users.threads.get({
                userId: 'me',
                id: threadId
            });

            const numReplies = threads.data.messages.length -1 
            if(numReplies> 0){
                console.log("Replied already!!");
            }
            else{
                const headers = res.data.payload.headers;
                const to = headers.find((header) => header.name === 'From').value;
                const subject = headers.find((header) => header.name === 'Subject').value;
                const messageBody = 'I am currently unavailable. I will reply as soon as possible.';
                
            const replyMessage = [
                'Content-Type: text/plain; charset=utf-8',
                `To: ${to}`,
                `Subject: Re: ${subject}`,
                '',
                messageBody
            ].join('\n');
            
            const encodedMessage = Buffer.from(replyMessage)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
            
            await gmail.users.messages.send({
                userId: 'me',
                threadId: id,
                resource: {
                    raw: encodedMessage
                }
            }, (err, res) => {
                if (err) return console.log('The API returned an error: ' + err);
                console.log('Reply sent!');
                
            async()=>{
                await gmail.users.messages.modify({
                    userId: 'me',
                    id: id,
                    resource:{
                        addLabelIds:['SPAM']
                    }
                },(err, res)=>{
                    if(err)console.log("error while modifying labels",err);
                    else console.log("RESPONSE of Labels=====>",res);
                })
            };
            })
        }
        });
    });
       
    setTimeout(listLabels,50000)// after 50 sec again invoke the function
    }

authorize().then(listLabels).catch(console.error);


