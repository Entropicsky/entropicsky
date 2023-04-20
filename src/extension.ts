import * as vscode from 'vscode';
import { Configuration, OpenAIApi } from 'openai';

export function activate(context: vscode.ExtensionContext) {
    let disposableAskGPT = vscode.commands.registerCommand('extension.askGPT', async () => {
        // Retrieve the OpenAI API key from the user's settings
        const apiKey = vscode.workspace.getConfiguration('chatgpt').get<string>('openaiApiKey');
        if (!apiKey) {
            vscode.window.showErrorMessage('Please provide an OpenAI API key in the extension settings.');
            return;
        }

        // Initialize the OpenAI API client with the user's API key
        const configuration = new Configuration({ apiKey });
        const openai = new OpenAIApi(configuration);

        // Access the currently active text editor
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active text editor found.');
            return;
        }

        // Access the selected code in the active text editor
        const code = editor.document.getText(editor.selection);

        // Create and show the Webview Panel
        const panel = vscode.window.createWebviewPanel(
            'askGPT', // Identifies the type of the webview
            'Ask GPT', // Title of the panel displayed to the user
            vscode.ViewColumn.Beside, // Editor column to show the new webview panel in
            {
                enableScripts: true, // Allow scripts to run in the webview
            } // Webview options
    );

// Set the initial HTML content of the Webview Panel
console.log('We are starting'); // Add this line for debugging
panel.webview.html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Ask GPT</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                margin: 16px;
                background-color: var(--vscode-editor-background);
                color: var(--vscode-editor-foreground);
            }
            h1 {
                font-size: 1.5em;
                margin-bottom: 8px;
            }
            form {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            textarea {
                resize: vertical;
                background-color: var(--vscode-editorWidget-background);
                color: var(--vscode-editorWidget-foreground);
                border: 1px solid var(--vscode-editorWidget-border);
                padding: 8px;
                border-radius: 4px;
            }
            button {
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                padding: 8px;
                border-radius: 4px;
                cursor: pointer;
            }
            button:hover {
                background-color: var(--vscode-button-hoverBackground);
            }
            #answer {
                margin-top: 16px;
                border: 1px solid var(--vscode-editorWidget-border);
                padding: 8px;
                border-radius: 4px;
                background-color: var(--vscode-editorWidget-background);
                color: var(--vscode-editorWidget-foreground);
                white-space: pre-wrap;
            }
        </style>
    </head>
    <body>
        <h1>Ask a question about the code:</h1>
        <form>
            <textarea id="question-input" rows="4" cols="50"></textarea>
            <button id="submit-button" type="submit">Submit</button>
        </form>
        <div id="loading" style="display: none;">Processing your request...</div>
        <div id="answer"></div>
        <script>
            const vscode = acquireVsCodeApi();
            document.querySelector('form').addEventListener('submit', (event) => {
                event.preventDefault();
                console.log('Submit button clicked'); // Add this line for debugging
                const questionInput = document.getElementById('question-input');
                const question = questionInput.value;
                vscode.postMessage({ question });
                document.getElementById('loading').style.display = 'block';
            });

            document.getElementById('question-input').focus();

            // Add a message listener to receive the answer from the extension
            window.addEventListener('message', (event) => {
                const message = event.data; // The data sent from the extension
                if (message.answer) {
                    document.getElementById('loading').style.display = 'none';
                    const answerElement = document.getElementById('answer');
                    answerElement.textContent = message.answer;
                }
            });
        </script>
    </body>
    </html>
`;
    



        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(async (message) => {
            console.log('Received message from webview:', message); // Add this line for debuggin
            const question = message.question;

            // Construct the prompt to send to the GPT-3.5-Turbo API
            const prompt = `Code:\n${code}\nQuestion: ${question}\nAnswer:`;

            try {
                // Send the prompt to the GPT-3.5-Turbo API and receive a response
                // eslint-disable-next-line @typescript-eslint/naming-convention
                const response = await openai.createCompletion({ model: 'text-davinci-003', prompt, max_tokens: 2048 });
                const answer = (response.data.choices?.[0]?.text ?? 'No answer provided.').trim();

                // Display the answer in the Webview Panel by sending a message to the webview
                panel.webview.postMessage({ answer });
            } catch (error: unknown) {
                // Handle errors and display an error message
                if (typeof error === 'object' && error !== null && 'response' in error) {
                    const apiError = error as { response: { status: number; data: any } };
                    console.error('API Error:', apiError.response.status, apiError.response.data);
                } else {
                    console.error('General Error:', (error as Error).message);
                }
                vscode.window.showErrorMessage('An error occurred while processing the request.');
            }
        }, undefined, context.subscriptions);

        // Update the HTML content of the Webview Panel when receiving an answer
        // Update the HTML content of the Webview Panel when receiving an answer
        panel.webview.onDidReceiveMessage(
            (message) => {
                if (message.answer) {
                    panel.webview.html = `
                        <h1>Ask a question about the code:</h1>
                        <form>
                            <textarea id="question" rows="4" cols="50"></textarea>
                            <button type="submit">Submit</button>
                        </form>
                        <div id="answer">${message.answer}</div>
                        <script>
                            const vscode = acquireVsCodeApi();
                            document.querySelector('form').addEventListener('submit', (event) => {
                            event.preventDefault();
                            const question = document.getElementById('question').value;
                            vscode.postMessage({ question });
                            });
                        </script>
                `;
            }
    },
    undefined,
    context.subscriptions
);
    });

    context.subscriptions.push(disposableAskGPT);
}

export function deactivate() {}
