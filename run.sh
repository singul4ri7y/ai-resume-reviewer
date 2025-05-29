#!/usr/bin/env sh

OLLAMA_CONTEXT_LENGTH=65536

# Check if any Ollama server is running. If not, start the server.
if ! pgrep -u $USER -x "ollama" > /dev/null; then
    ollama serve > /dev/null 2> /dev/null &
fi

# If latest LLaMA 3.2 model is not found, pull it.
if ! ollama list | grep llama3.2:latest > /dev/null; then
    ollama pull llama3.2:latest > /dev/null
fi

# Install all the required dependencies.
npm install

# Start the app.
npm run start