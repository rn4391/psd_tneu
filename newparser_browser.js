
import * as helperParser from "./helperparser_browser.js";
import {config} from "./config.js"
import { encode, decode } from 'js-base64';
import Psd from "@webtoon/psd";

window.IKNamespace = {};
window.IKNamespace.ikOutput = {};

window.IKNamespace.parsePSDFile = async function(buffer, options) {
    const psdFile = Psd.parse(buffer);

    let fileHeader = psdFile.parsingResult.fileHeader;
    window.IKNamespace.ikOutput.width = fileHeader.width;
    window.IKNamespace.ikOutput.height = fileHeader.height;
    window.IKNamespace.ikOutput.layers = [];
    window.IKNamespace.OUTPUT_DIR = (options.fileName).replace(/[^a-z0-9]/gi, '_').toLowerCase();

    await traverseNode(psdFile);
    window.IKNamespace.ikOutput.layers.splice(0,0, {
        w : window.IKNamespace.ikOutput.width,
        h : window.IKNamespace.ikOutput.height
    });

    let transformationParameter = convertToIKTransform(window.IKNamespace.ikOutput);

    return {
        layers : window.IKNamespace.ikOutput.layers,
        finalUrl : config.CANVAS_FILE + "?tr=" + transformationParameter + "&v=" + (new Date()).getTime()
    }
}

window.IKNamespace.convertTransformStringToJSON = function(transformedString) {
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
            layer.i = decode(decodeURIComponent(layer.ie));
        }
        output.layers.push(layer);
    });

    return output;
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
                await helperParser.processTextLayer(node, window.IKNamespace.ikOutput.layers);
            } else {
                await helperParser.processImageLayer(node, window.IKNamespace.ikOutput.layers, {
                    OUTPUT_DIR: window.IKNamespace.OUTPUT_DIR,
                    canvasWidth: window.IKNamespace.ikOutput.width,
                    canvasHeight: window.IKNamespace.ikOutput.height
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