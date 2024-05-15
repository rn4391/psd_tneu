
import * as helperParser from "./helperParser.js";
import {config} from "./config.js"

import * as path from "path";
import Psd from "@webtoon/psd";
import ImageKit from "imagekit";
import fs from 'fs-extra'
import yargs from 'yargs/yargs';

var argv = yargs(process.argv.slice(2)).parse();

if(argv.mode === "transformToJSON") {
    console.log(convertToIKLayers(argv.transform || ""));
    process.exit(0);
}

let PSDFilePath = argv.file;
if(!PSDFilePath) {
    console.error("Error: No input file specified");
    process.exit(1);
}

const OUTPUT_DIR = PSDFilePath.replace(/[^a-z0-9]/gi, '_').toLowerCase();
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR);
}
fs.emptyDirSync(OUTPUT_DIR);

const fileModifiedTime = fs.statSync(path.resolve(PSDFilePath)).mtimeMs;

let imagekit = new ImageKit({
    publicKey: config.PUBLIC_KEY,
    privateKey: config.PRIVATE_KEY,
    urlEndpoint: config.URL_ENDPOINT
});

const psdData = fs.readFileSync(PSDFilePath);
// Pass the ArrayBuffer instance inside the Buffer
const psdFile = Psd.parse(psdData.buffer);

// console.log(psdFile.parsingResult.layerAndMaskInfo.layers[3].layerProperties.textProperties.DocumentResources.FontSet);
let fileHeader = psdFile.parsingResult.fileHeader;
// let resolutionInfo = psdFile.resolutionInfo;

let ikOutput = {};
ikOutput.width = fileHeader.width;
ikOutput.height = fileHeader.height;
ikOutput.layers = [];


await traverseNode(psdFile);
ikOutput.layers.splice(0,0, {
    w : ikOutput.width,
    h : ikOutput.height
});

let transformationParameter = convertToIKTransform(ikOutput);

if(argv.output == "json") {
    console.log(ikOutput.layers);
} else {
    console.log(config.CANVAS_FILE + "?tr=" + transformationParameter + "&v=" + fileModifiedTime);
}

if(argv['upload-files'] == "true") {
    await uploadImagesFromPSDFile();
}

// Recursively traverse layers and layer groups
async function traverseNode(node) {
    if(node.type === "Group") {
        if(!helperParser.isLayerHidden(node)) {
            // Await all recursive operations on children to complete
            if (node.children) {
                for (let child of node.children) {
                    await traverseNode(child);
                }
            }
        }
    }
    else if (node.type === "Layer") {
        if(!helperParser.isLayerHidden(node)) {
            if (node.textProperties) {
                await helperParser.processTextLayer(node, ikOutput.layers);
            } else {
                await helperParser.processImageLayer(node, ikOutput.layers, {
                    OUTPUT_DIR: OUTPUT_DIR,
                    canvasWidth: ikOutput.width,
                    canvasHeight: ikOutput.height
                });
            }

            if (node.children) {
                for (let child of node.children) {
                    await traverseNode(child);
                }
            }
        }
    } else if (node.type === "Psd") {
        if (node.children) {
            for (let child of node.children) {
                await traverseNode(child);
            }
        }
    } else {
        throw new Error("Invalid node type");
    }

    return true;
}

function convertToIKTransform(ikOutput) {
    let layers = [];
    for(var i in ikOutput.layers) {
        let parts = []
        if(ikOutput.layers[i].type == "image") {
            parts.push("l-image");
            for(var j in ikOutput.layers[i]) {
                if(j == "type") continue;
                parts.push([j,ikOutput.layers[i][j]].join("-"))
            }
            parts.push("l-end");
        } else if(ikOutput.layers[i].type == "text") {
            parts.push("l-text");
            for(var j in ikOutput.layers[i]) {
                if(j == "type" || j == "i") continue;
                parts.push([j,ikOutput.layers[i][j]].join("-"))
            }
            parts.push("l-end");
        } else {
            for(var j in ikOutput.layers[i]) {
                parts.push([j,ikOutput.layers[i][j]].join("-"))
            }
        }
        layers.push(parts.join(","));
    }
    return layers.join(":");
}

function convertToIKLayers(transformedString) {
    // Split the main string by ':' to separate width, height, and layers
    const parts = transformedString.split(':');

    const output = {
        layers: []
    };

    // Process each remaining part as a layer
    parts.forEach(part => {
        const layerParts = part.split(',');
        const layer = {};
        // Iterate over each item in the layer excluding the first and last (which are type and 'l-end')
        layerParts.forEach(item => {
            if(item === "l-text") {
                layer['type'] = "text";
            } else if(item === "l-image") {
                layer['type'] = "image";
            }

            if (item === "l-end" || item === "l-image" || item === "l-text") return; // Skip 'l-end'
            
            const itemParts = item.split('-');
            const key = itemParts[0];
            const value = itemParts[1];

            // Differentiate between number and string values
            layer[key] = isNaN(value) ? value : parseInt(value, 10);
        });
    
        if(layer.type == "text" && layer.ie && !layer.i) {
            layer.i = new Buffer.from(decodeURIComponent(layer.ie), "base64").toString()
        }
        output.layers.push(layer);
    });

    return output;
}

async function uploadImagesFromPSDFile() {
    const files = fs.readdirSync(OUTPUT_DIR, { encoding: "buffer", withFileTypes: "png" });

    for (let file of files) {
        const filePath = path.join(OUTPUT_DIR, file.name.toString());

        // Create a readable stream for the file
        const fileStream = fs.readFileSync(filePath);

        // Upload the file to ImageKit
        const uploadResponse = await imagekit.upload({
            file: fileStream,
            fileName: file.name.toString(),
            folder: OUTPUT_DIR,
            useUniqueFileName: false
        });

        // Handle the response from ImageKit (you can log or process it as needed)
        console.log(`Uploaded ${file}:`);
        console.log(uploadResponse);
    };
}