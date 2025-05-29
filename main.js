const { app, net, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path')
const fs = require('fs')
const pdfparse = require('pdf-parse')

// Creates the main window
function create_window() {
    const win = new BrowserWindow({
        width: 400,
        height: 400,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    win.loadFile('renderer/index.html');
    win.setMenuBarVisibility(false);
    app.mainWindow = win;
}

app.whenReady().then(() => create_window());
app.clearRecentDocuments();

let isProcessing = false;

ipcMain.handle('evaluate-resume', async (event, resume_path, jd) => {
    if(isProcessing) 
        return;

    request = net.request({
        method: 'POST',
        protocol: 'http',
        hostname: 'localhost',
        port: 11434,
        path: '/api/generate'
    });

    request.setHeader('Content-Type', 'application/json');
    request.on('response', response => {
        response.on('data', chunk => {
            let parsed_json = JSON.parse(chunk.toString());
            if(parsed_json.done) {
                app.mainWindow.webContents.send('inference-done');
            }

            app.mainWindow.webContents.send('inference', parsed_json.response)
        });
    });

    // Extract resume content in plain text
    const resume_content = (await pdfparse(fs.readFileSync(resume_path))).text;
    const payload = JSON.stringify({
        model: 'llama3.2',
        prompt: `You are an HR expert who is really precise about Resumes. Given the following resume and job description, evaluate how well the resume fits the job.

Resume:
${resume_content}

Job Description:
${jd}

Respond with:
- Relevance Score (0-100)
- Why this Relevance score?
- How to improve the relevance?

Respond With Markdown. Make header on aforementioned points. No === after headers.`,
        stream: true
    });

    request.write(payload);
    request.end()

    isProcessing = true;
});

ipcMain.handle('resume-path', async () => {
    return new Promise((resolve, reject) => {
        dialog.showOpenDialog({
            properties: [ 'openFile' ],
            defaultPath: '/home/singul4ri7y/Downloads/resume_dir'
        })
            .then(results => resolve(results.filePaths[0]))
            .catch(err => reject(err));
    });
})

// Window control
ipcMain.handle('window-control', (event, type) => {
    if(type === 'close') 
        app.mainWindow.close();
    else if(type === 'minimize')
        app.mainWindow.minimize();
    else app.mainWindow.maximize();
});

ipcMain.handle('evaluate-ats', async (_, resume_path) => {
    request = net.request({
        method: 'POST',
        protocol: 'http',
        hostname: 'localhost',
        port: 11434,
        path: '/api/generate'
    });

    request.setHeader('Content-Type', 'application/json');
    request.on('response', response => {
        response.on('data', chunk => {
            let parsed_json = JSON.parse(chunk.toString());
            if(parsed_json.done) {
                isProcessing = false;
                app.mainWindow.webContents.send('ats-done');
            }

            app.mainWindow.webContents.send('ats-inference', parsed_json.response)
        });
    });

    // Extract resume content in plain text
    const resume_content = (await pdfparse(fs.readFileSync(resume_path))).text;
    const payload = JSON.stringify({
        model: 'llama3.2:latest',
        prompt: `You are an expert ATS (Applicant Tracking System) analyzer.

I will give you the content of a resume.

Your task is to:
1. Evaluate how **ATS-compliant** the resume is on a scale of **0 to 100** as **ATS Score: [number here]**, based on formatting, keyword usage, and parsable structure.
2. List all the **ATS-parsable elements** you can detect, such as:
   - Name
   - Contact Information
   - Skills
   - Education
   - Work Experience
   - Certifications
   - Links
   - etc.
3. Mention any **issues** that could affect ATS parsing (e.g., unusual fonts, use of tables, images, improper section headings, etc.).
4. Give suggestions on how to improve ATS compliance if it's below 90.

Please format your response using **Markdown**. Use bullet points, numbered sections, and bold headings for clarity.

Here is the resume content:
${resume_content}
`,
        stream: true
    });

    request.write(payload);
    request.end()
})
