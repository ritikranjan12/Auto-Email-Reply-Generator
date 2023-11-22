### This file contains a Node.js application that automatically replies to unread emails containing specific keywords using the Gmail API.

 * It uses the Express framework for handling HTTP requests and the Google APIs Node.js Client for accessing the Gmail API.
 * The application authenticates with Google APIs locally using the @google-cloud/local-auth package.
 * It defines functions for retrieving unreplied messages with specific keywords, creating a label for replied emails, and sending replies to the emails.
 * The application runs as a server and starts a task that periodically checks for unreplied messages and sends replies if necessary.
 * The task is started when the root route ("/") is accessed.
 * The server listens on port 8080.

### Code needs improvement in the fields

- Filtering out emails that contains keywords more precisely.
- Give some dynamic response based on the email recieved.