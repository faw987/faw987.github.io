
//
// dec28key
//

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