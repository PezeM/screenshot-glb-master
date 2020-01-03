const puppeteer = require('puppeteer');

module.exports = async (page, {glbPath, outputPath, format, quality}) => {
  return new Promise((resolve) => {
    try {
      page.exposeFunction('resolvePromise', resolve);

      page.evaluate(async (browser_glbPath, browser_outputPath, browser_format, browser_quality) => {
        const waitUntil = async (check, interval, timeout) => {
          var endTime = Date.now() + timeout;
  
          const checkCondition = (resolve, reject) => {
            if (check()) {
              resolve()
            } else if (Date.now() < endTime) {
              setTimeout(checkCondition, interval, resolve, reject);
            } else {
              reject('Wait until timeout');
            }
          }
  
          return new Promise(checkCondition);
        }
  
        modelViewer = document.getElementById('snapshot-viewer');
        modelViewer.src = browser_glbPath;
        document.body.appendChild(modelViewer);
  
        await waitUntil(() => { 
          return modelViewer.modelIsVisible;
        }, 10, 10000);
  
        await window.saveDataUrl(
          modelViewer.toDataURL(browser_format, browser_quality), 
          browser_outputPath,
        );
  
        window.resolvePromise();
      }, glbPath, outputPath, format, quality);
    } catch (error) {
      console.error(error);
    }
  });
}
