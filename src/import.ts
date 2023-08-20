import 'dotenv/config';
import fs from 'fs';
import weaviate, { WeaviateClient, ObjectsBatcher, ApiKey } from 'weaviate-ts-client';


const client: WeaviateClient = weaviate.client({
    scheme: 'http',
    host: 'localhost:8080',
    headers: { 'X-OpenAI-Api-Key': `${process.env.OPENAI_KEY}`}
});

const classObj = {
    'class': 'Question',
    'vectorizer': 'text2vec-openai',
    'moduleConfig': {
        'text2vec-openai': {},
        'generative-openai': {}
    },
};

async function addSchema() {
    const res = await client.schema.classCreator().withClass(classObj).do();
    console.log(res);
}

async function importQuestions() {
    const filePaths = ['.\\assets\\jeopardy_data_1.json', '.\\assets\\jeopardy_data_2.json'];

    let batcher: ObjectsBatcher = client.batch.objectsBatcher();
    const batchSize = 100;

    for (const filePath of filePaths) {
        console.log(`reading file ${filePath}`)
        let counter = 0;
        let rawData = fs.readFileSync(filePath, 'utf8');
        let questions = JSON.parse(rawData);

        for(const question of questions) {
            const obj = {
                class: 'Question',
                properties: {
                    fileSource: filePath,
                    answer: question.Answer,
                    question: question.Question,
                    category: question.Category
                }
            }

            batcher = batcher.withObject(obj);

            if(counter++ == batchSize) {
                const res = await batcher.do();
                console.log(res);

                counter = 0;
                batcher = client.batch.objectsBatcher();
            }
        }
        
        // flush the batcher
        const res = await batcher.do();
        console.log(res);
    }
}

async function generativeSearchQuery() {
    console.log(`openai key: ${process.env.OPENAI_KEY}`);

    const res = await client.graphql
        .get()
        .withClassName('Question')
        .withFields('question answer category fileSource')
        .withNearText({concepts: ['human body parts'], 'distance': 0.7})
        .withGenerate({singlePrompt: 'Explain the {answer} in the style of George Carlin.'})
        .withLimit(2)
        .do();

    console.log(JSON.stringify(res, null, 2));
    return res;
}

async function run() {
    //await addSchema();
    await importQuestions();
    await generativeSearchQuery();
}

await run();

