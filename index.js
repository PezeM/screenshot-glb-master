const path = require('path');
const pLimit = require('p-limit');
const fs = require('fs');
const util = require('util');
const readdir = util.promisify(fs.readdir);
const FileServer = require('./src/file-server');
const startBrowser = require('./src/start-browser')
const loadGLBAndScreenshot = require('./src/load-glb-and-screenshot');

const CONFIG = require('./config');
const concurrencyLimit = pLimit(CONFIG.concurrencyLimit);

let libServer;

async function makeScreenshot(input, output) {
    try {
        const startTime = Date.now();
        const inputPath = `${CONFIG.sourceFolder}/${input}`;
        const modelServer = new FileServer(path.dirname(inputPath));
        await modelServer.start()
      
        const glbPath = `http://localhost:${modelServer.port}/${path.basename(inputPath)}`;
        const {page, browser} = await startBrowser({width: CONFIG.width, height: CONFIG.height, libPort: libServer.port});
      
        await loadGLBAndScreenshot(page, {
          glbPath,
          outputPath: output,
          format: CONFIG.format,
          quality: CONFIG.quality,
        });
    
        await browser.close();
        await modelServer.stop();
      
        console.log(`Finished converting ${input} in ${Date.now() - startTime}ms.`);
    } catch (error) {
        console.error(`Couldn't convert ${input}. Error: ${error}.`);
    }
};

async function start() {
    let objectNames;
    try {
      objectNames = await readdir(CONFIG.sourceFolder);
    } catch (err) {
      console.log(err);
    }

    if(!objectNames || objectNames.length <= 0) {
        console.log(`Specified source folder contains no files.`);
        return;
    }

    const promises = objectNames.map(name => {
        return concurrencyLimit(() => makeScreenshot(name, 
            `${CONFIG.outputFolder}/${name.split('.').slice(0, -1).join('.')}.${CONFIG.outputExtension}`));
    });

    console.log(`Starting to convert ${objectNames.length} objects.`);
    libServer = new FileServer(path.resolve(__dirname, './lib'));
    await libServer.start();

    await Promise.all(promises);
    console.log(`Finished converting ${objectNames.length} objects.`);
    process.exit();
}
  
start();