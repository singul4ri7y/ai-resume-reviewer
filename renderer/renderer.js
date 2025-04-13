// Elements
const resumeButton = document.getElementById('resume-file-select');
const evaluateButton = document.getElementById('evaluate');
const jdTextarea = document.getElementById('jd');
const output = document.getElementById('output');
const emptyState = document.getElementById('empty-state');
const statusIndicator = document.querySelector('.status-indicator');
const statusText = document.querySelector('.status span');
const atsSection = document.getElementById('ats-section');
const atsContent = document.getElementById('ats-content');
const atsScore = document.getElementById('ats-score');

// Window control buttons
const minimizeBtn = document.getElementById('minimize-btn');
const maximizeBtn = document.getElementById('maximize-btn');
const closeBtn = document.getElementById('close-btn');

// Initialize
output.style.display = 'none';
emptyState.style.display = 'flex';
atsSection.style.display = 'none';

// Resume file selection
resumeButton.onclick = async (e) => {
try {
  const filepath = await window.ipcRenderer.invoke('resume-path');
  if (filepath) {
    resumeButton.filepath = filepath;
    resumeButton.classList.add('has-file');
    
    // Extract and display filename
    const fileName = filepath.split(/[\\/]/).pop();
    const fileInfo = resumeButton.querySelector('.file-info');
    fileInfo.textContent = fileName;
  }
} catch (error) {
  console.error('Error selecting file:', error);
}
};

// Buffer for collecting markdown chunks
let markdownBuffer = '';
let atsBuffer = '';
// Did the user scroll?
let scrolled = false;

// Evaluate button
evaluateButton.onclick = async () => {
    const resume = resumeButton.filepath || '';
    const jd = jdTextarea.value.trim() || '';

    markdownBuffer = '';
    atsBuffer = '';
    scrolled = false;

    if (!resume) {
        createNotification('Please upload a resume first');
        return;
    }

    if (!jd) {
        createNotification('Please paste a job description');
        return;
    }

    // Hide ATS section when starting a new evaluation
    atsSection.style.display = 'none';
    atsScore.textContent = '--';
    atsScore.className = 'score-value';
    
    // Show loading state
    evaluateButton.classList.add('loading');
    evaluateButton.disabled = true;
    statusIndicator.classList.remove('ready');
    statusIndicator.classList.add('processing');
    statusText.textContent = 'Processing...';

    // Hide empty state, show output
    emptyState.style.display = 'none';
    output.style.display = 'block';

    try {
        // Start evaluation
        await window.ipcRenderer.invoke('evaluate-resume', resume, jd);
    } catch (error) {
        output.innerHTML += renderMarkdown('**Error:** Unable to process resume. Please try again.');
        console.error('Evaluation error:', error);
    }
};

// Listen for streaming results
window.ipcRenderer.on('inference', (event, token) => {
  // If this is the first token, hide empty state
  if (emptyState.style.display !== 'none') {
    emptyState.style.display = 'none';
    output.style.display = 'block';
    markdownBuffer = '';
  }
  
  // Add token to buffer
  markdownBuffer += token;
  
  // Render the entire buffer as markdown
  output.innerHTML = renderMarkdown(markdownBuffer);
  
  // Auto-scroll to bottom as content comes in
  const outputContainer = document.querySelector('.output-container');
  if(!scrolled) outputContainer.scrollTop = outputContainer.scrollHeight;
});

// Listen for ATS streaming results
window.ipcRenderer.on('ats-inference', (event, token) => {
  // If this is the first token and ATS section is hidden, show it with animation
  if (atsSection.style.display === 'none') {
    atsSection.style.display = 'block';
    // Only animate if it wasn't previously visible
    atsSection.classList.add('animate');
    atsBuffer = '';
    
    // Remove animation class after animation completes
    setTimeout(() => {
      atsSection.classList.remove('animate');
    }, 500);
  }
  
  // Add token to ATS buffer
  atsBuffer += token;
  
  // Try to extract ATS score from the content
    const scoreMatch = atsBuffer.match(/ATS Score:\s*(\d+)/i);
    if (scoreMatch && scoreMatch[1]) {
    const score = parseInt(scoreMatch[1]);
    atsScore.textContent = score + '/100';
    
    // Add color class based on score
    atsScore.className = 'score-value';
    if (score >= 80) {
        atsScore.classList.add('high');
    } else if (score >= 60) {
        atsScore.classList.add('medium');
    } else {
        atsScore.classList.add('low');
    }
    }
  
  // Render the entire buffer as markdown
  atsContent.innerHTML = renderMarkdown(atsBuffer);
  
  // Auto-scroll to ATS section if not manually scrolled
  if(!scrolled) {
    const outputContainer = document.querySelector('.output-container');
    const atsTop = atsSection.offsetTop;
    outputContainer.scrollTop = atsTop - 20; // Scroll to ATS with a small offset
  }
});

document.querySelector('.output-container').onwheel = () => scrolled = true;

closeBtn.onclick = e => ipcRenderer.invoke('window-control', 'close');
minimizeBtn.onclick = e => ipcRenderer.invoke('window-control', 'minimize');
maximizeBtn.onclick = e => ipcRenderer.invoke('window-control', 'maximize');

window.ipcRenderer.on('inference-done', async () => {
    const resume = resumeButton.filepath || '';

    // Start ATS evaluation
    await window.ipcRenderer.invoke('evaluate-ats', resume);
});

window.ipcRenderer.on('ats-done', () => {
    // Reset UI state when both evaluations are complete
    evaluateButton.classList.remove('loading');
    evaluateButton.disabled = false;
    statusIndicator.classList.remove('processing');
    statusIndicator.classList.add('ready');
    statusText.textContent = 'Ready';
});

// Simple notification function
function createNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.position = 'fixed';
    notification.style.bottom = '80px';
    notification.style.right = '20px';
    notification.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    notification.style.color = 'white';
    notification.style.padding = '10px 16px';
    notification.style.borderRadius = '4px';
    notification.style.zIndex = '9999';
    notification.style.maxWidth = '300px';
    notification.style.boxShadow = '0 3px 6px rgba(0,0,0,0.2)';

    document.body.appendChild(notification);

    setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.5s ease';
    
    setTimeout(() => {
        document.body.removeChild(notification);
    }, 500);
    }, 3000);
}

// Simple markdown parser function
function renderMarkdown(markdown) {
if (!markdown) return '';

// Process code blocks with syntax highlighting
markdown = markdown.replace(/```(\w*)([\s\S]*?)```/g, function(match, language, code) {
  return `<div class="code-block${language ? ' language-' + language : ''}"><pre>${escapeHtml(code.trim())}</pre></div>`;
});

// Process inline code
markdown = markdown.replace(/`([^`]+)`/g, '<code>$1</code>');

// Process headers
markdown = markdown.replace(/^#### (.*$)/gm, '<h4>$1</h4>');
markdown = markdown.replace(/^### (.*$)/gm, '<h3>$1</h3>');
markdown = markdown.replace(/^## (.*$)/gm, '<h2>$1</h2>');
markdown = markdown.replace(/^# (.*$)/gm, '<h1>$1</h1>');

// Process lists
markdown = markdown.replace(/^\* (.*$)/gm, '<ul><li>$1</li></ul>');
markdown = markdown.replace(/^- (.*$)/gm, '<ul><li>$1</li></ul>');
markdown = markdown.replace(/^\d+\. (.*$)/gm, '<ol><li>$1</li></ol>');

// Process blockquotes
markdown = markdown.replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>');

// Process bold and italic
markdown = markdown.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
markdown = markdown.replace(/\*([^*]+)\*/g, '<em>$1</em>');
markdown = markdown.replace(/\_\_([^_]+)\_\_/g, '<strong>$1</strong>');
markdown = markdown.replace(/\_([^_]+)\_/g, '<em>$1</em>');

// Process horizontal rule
markdown = markdown.replace(/^(-{3,}|_{3,}|\*{3,})$/gm, '<hr>');

// Process links
markdown = markdown.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

// Process paragraphs (must be done last)
markdown = markdown.replace(/^(?!<[a-z])[^\n]+/gm, function(match) {
  return `<p>${match}</p>`;
});

// Fix nested lists issue
markdown = markdown.replace(/<\/ul>\s*<ul>/g, '');
markdown = markdown.replace(/<\/ol>\s*<ol>/g, '');

return markdown;
}

// Helper function to escape HTML in code blocks
function escapeHtml(unsafe) {
return unsafe
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");
}