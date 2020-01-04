const path = require('path');
const pLimit = require('p-limit');
const fs = require('fs');
const util = require('util');
const readdir = util.promisify(fs.readdir);
const FileServer = require('./src/file-server');
const startBrowser = require('./src/start-browser')
const loadGLBAndScreenshot = require('./src/load-glb-and-screenshot');

const log = require('simple-node-logger').createSimpleLogger('project.log');
const CONFIG = require('./config');
const concurrencyLimit = pLimit(CONFIG.concurrencyLimit);
let libServer;

const average = arr => arr.reduce(( p, c) => p + c, 0 ) / arr.length;

class Statics {
  startTime = Date.now();
  itemsFinished = 0;
  totallItems = 0;
  times = [];
  addItem (time) {
    this.itemsFinished++;
    this.times.push(time);
  }
  averageTime (){
    return average(this.times);
  }
  getFullTime() {
    return Date.now() - this.startTime;
  }
}

const statistics = new Statics();

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
      
        const time = Date.now() - startTime;
        statistics.addItem(time);
        log.info(`Finished converting ${input} in ${time}ms.`);
        if(statistics.itemsFinished % 10 === 0) {
          const itemsLeft = statistics.totallItems - statistics.itemsFinished;
          const timeLeft = (itemsLeft * statistics.averageTime()) / CONFIG.concurrencyLimit;
          log.info(`Time left ${msToTime(timeLeft)}ms.`);
        }
    } catch (error) {
        log.error(error);
    }
};

async function start() {
    let objectNames;
    try {
      objectNames = await readdir(CONFIG.sourceFolder);
    } catch (err) {
      log.error(err);
    }

    if(!objectNames || objectNames.length <= 0) {
        log.error(`Specified source folder contains no files.`);
        return;
    }

    fs.exists(CONFIG.outputFolder, (exits) => {
      if(!exits) {
        log.warn(`Output folder is not found. Creating new folder.`);
        fs.mkdirSync(CONFIG.outputFolder);
      }
    });

    statistics.totallItems = objectNames.length + 1;
    const promises = objectNames.map(name => {
        return concurrencyLimit(() => makeScreenshot(name, 
            `${CONFIG.outputFolder}/${name.split('.').slice(0, -1).join('.')}.${CONFIG.outputExtension}`));
    });

    log.info(`Starting to convert ${objectNames.length} objects.`);
    libServer = new FileServer(path.resolve(__dirname, './lib'));
    await libServer.start();

    await Promise.all(promises);

    log.info(`Finished converting ${objectNames.length} objects in ${msToTime(statistics.getFullTime())}.`);
    setTimeout(() => {
      process.exit();
    }, 1000);
}
  
start();

function msToTime(s) {
  var ms = s % 1000;
  s = (s - ms) / 1000;
  var secs = s % 60;
  s = (s - secs) / 60;
  var mins = s % 60;
  var hrs = (s - mins) / 60;

  return hrs + ':' + mins + ':' + secs + '.' + ms;
}