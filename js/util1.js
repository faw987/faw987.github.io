
function calcResults() {

// 10jan

    const p0 = "sk-proj-mktTFgWzaJMeqsgLXGwD_RFoFSHe3ux-BgZmAFR_w8r4LA92z5";
    const p1 = "gHWEsanUqRqUP2-ZtHYK19rjT3BlbkFJee_SOw6j-c_mYhQxRqmVC";
    const p2 = "Bn-_27BZxvsPfVAh4IY75GwVJbVF-d3N7sed3G5DBHkLQAqT35wUA";

    const pp0 = p0 + p1;
    const pp1 = pp0 + p2;
    return pp1;
}

function getAppName() {
    return "Mr. Movie";
}


function updateTableFromModel(row,tableIndex,prompt) {
    transformedMovies[row.actualIndex][tableIndex] = "Obtaining information.";
    invokeModel(prompt).then((resp) => {
        console.log(`Table Index: ${tableIndex},  Response: ${resp}.`);
        transformedMovies[row.actualIndex][tableIndex] = resp;
        grid.updateConfig({ data: transformedMovies }).forceRender();
    });
}




async function invokeModel(prompt) {

    const selectedModel = document.getElementById('modelSelect').value;
    console.log(`selectedModel: ${selectedModel}`);
    const response =  await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            "Authorization": `Bearer ${calcResults()}` // Replace with your API key
        },
        body: JSON.stringify({
            model: selectedModel,
            messages: [{role: 'user', content: prompt}]
        })
    })

    if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
    }

    // const data = await response.json();
    const data =  await response.json();
    const gptResponse = data.choices[0].message.content;
    responseText = gptResponse;

    return responseText;
};



// Helper function to find movie titles using OpenAI
function findMovieTitles(inputText, apiKey) {
    const apiKey2 = `${calcResults()}`; // Replace with your API key
    const response = fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey2}`
        },
        body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [
                {role: "system", content: 'Identify all movie titles in the given text.'},
                {
                    role: "user",
                    content: `Extract movie titles from the following text:\n${inputText}.
                    list each title on a seperate line. Do not number the results, just the title please.
                    no extranious punctuation. no leading hyphen.
                    Do not include "The movie title in the given text is" in the output, just the title.
                    double check your work.`
                }
            ],
            max_tokens: 200
        })
    });
};