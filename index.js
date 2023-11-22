// Express is a minimal and flexible Node.js web application framework that provides a robust set of features for web and mobile applications.
const express = require("express");
// The path module provides utilities for working with file and directory paths.
const path = require("path");
// The @google-cloud/local-auth package is used to authenticate with Google APIs locally.
const { authenticate } = require("@google-cloud/local-auth");
// Google APIs Node.js Client is a Node.js client library for accessing Google APIs.
const { google } = require("googleapis");

// Create a new express application named 'app'
const app = express();

//specify what actions or data the application is allowed to access on behalf of the user.
const SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly", // Allows the application to view and retrieve but not modify the user's Gmail data.
    "https://www.googleapis.com/auth/gmail.send", // Allows the application to send emails on behalf of the user.
    "https://www.googleapis.com/auth/gmail.labels", // Allows the application to manage the user's Gmail labels.
    "https://mail.google.com/",
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/gmail.modify",
];

// Keywords to check whether email contains this or not
const keywords = [
    "kindly reply",
    "kindly reply to this mail.",
    "kindly reply with your resume.",
    "kindly reply with your email",
    "looking for your response.",
    "kindly reply back",
    "please respond",
    "awaiting your reply",
    "hearing from you",
    "look forward to hearing from you.",
];

// Generated Label Name for the emails that are replied 
const labelName = "Replied on Ritik's Behalf";

// Get all the labels
async function getAllLabels(gmail) {
    const response = await gmail.users.labels.list({
        userId: "me",
    });
    console.log(response.data.labels);
}

// Get the body of the email
function getEmailBody(email) {
    const parts = email.payload.parts;

    if (!parts || parts.length === 0) {
        return "";
    }

    // Find the first text/plain part in the email
    const plainTextPart = parts.find(part => part.mimeType === "text/plain");

    if (plainTextPart) {
        // Decode and return the body of the text/plain part
        return Buffer.from(plainTextPart.body.data, "base64").toString("utf-8");
    }
    return "";
}

// Get the unreplied messages that contains keywords
async function getUnrepliedMessagesWithKeywords(gmail, auth) {
    const response = await gmail.users.messages.list({
        userId: "me",
        labelIds: ["INBOX"],
        q: "is:unread",
        maxResults: 5,
    });

    const unrepliedMessages = response.data.messages || [];

    // console.log(unrepliedMessages);
    const filteredMessages = await Promise.all(
        unrepliedMessages.map(async (message) => {
            const messageData = await gmail.users.messages.get({
                auth,
                userId: "me",
                id: message.id,
            });

            const emailBody = getEmailBody(messageData.data);

            return {
                messageId: message.id,
                hasKeywords: keywords.some(keyword => emailBody.toLowerCase().includes(keyword.toLowerCase()))
            };
        })
    );
    // 
    const msg = filteredMessages.filter((message) => message.hasKeywords);
    // console.log(msg);
    return msg;
}

// Create a label
async function createLabel(gmail) {
    try {
        const response = await gmail.users.labels.create({
            userId: "me",
            requestBody: {
                name: labelName,
                labelListVisibility: "labelShow",
                messageListVisibility: "show",
            },
        });
        return response.data.id;
    } catch (error) {
        // If label already exists, return the label id
        if (error.code === 409) {
            const response = await gmail.users.labels.list({
                userId: "me",
            });
            // console.log(response.data.labels);
            const label = response.data.labels.find(
                (label) => label.name === labelName
            );
            return label.id;
        } else {
            throw error;
        }
    }
}

// Get a random interval between min and max
const getRandomInterval = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

// Start the task
const startTask = async () => {
    // Authenticate
    const auth = await authenticate({
        keyfilePath: path.join(__dirname, "credentials.json"),
        scopes: SCOPES,
    });

    const gmail = google.gmail({ version: "v1", auth });

    // Create a label
    const labelId = await createLabel(gmail);

    const intervalId = setInterval(async () => {
        // Get unreplied messages with keywords
        const messages = await getUnrepliedMessagesWithKeywords(gmail, auth);

        if (messages && messages.length > 0) {
            // 
            for (const msg of messages) {
                const messageData = await gmail.users.messages.get({
                    auth,
                    userId: "me",
                    id: msg.messageId,
                });

                const Email = messageData.data;

                // Check if the email is already replied
                const Replied = Email.payload.headers.some(
                    (header) => header.name === "In-Reply-To"
                );

                if (!Replied) {
                    // Reply to the email
                    const replyMessage = {
                        userId: "me",
                        resource: {
                            raw: Buffer.from(
                                `To: ${Email.payload.headers.find(
                                    (header) => header.name === "From"
                                ).value
                                }\r\n` +
                                `Subject: Re: ${Email.payload.headers.find(
                                    (header) => header.name === "Subject"
                                ).value
                                }\r\n` +
                                `Content-Type: text/plain; charset="UTF-8"\r\n` +
                                `Content-Transfer-Encoding: 7bit\r\n\r\n` +
                                `Thank you for your email. I'm currently unavailable and will reply to you soon.\r\n` +
                                `Note: This is an auto-generated message. Please do not reply to this email.\r\n`
                            ).toString("base64"),
                        },
                    };

                    // Send the reply
                    await gmail.users.messages.send(replyMessage);
                    let mailid = Email.payload.headers.find(
                        (header) => header.name === "From"
                    ).value
                    
                    console.log("Replied to the email - " + mailid);
                    // Add label and move the email
                    gmail.users.messages.modify({
                        auth,
                        userId: "me",
                        id: msg.messageId,
                        resource: {
                            addLabelIds: [labelId],
                            removeLabelIds: ["INBOX"],
                        },
                    });
                }
            }
        }
    }, getRandomInterval(45, 120) * 1000);
};

// Start the task
app.get("/", (req, res) => {
    startTask();
    res.send("Task started!");
});

// Start the server
app.listen(8080, () => {
    console.log(`Server is running on port 8080`);
});