//runArray, StyleDict reasoning here - https://github.com/webtoon/psd/issues/64

import rgbHex from 'rgb-hex';
import sharp from 'sharp';
import * as fonts from "./fonts.js";

function isLayerHidden(layer) {
    // console.log(layer);
    if(layer.type === "Psd") return false;

    let layerProperties = layer.layerFrame.layerProperties;
    return (layerProperties.hidden || layerProperties.opacity == 0);
}

function getLayerProperties(layer) {
    return layer?.layerFrame?.layerProperties || {};
}

async function processTextLayer(layer, parsedLayers, originalFonts) {
    let layerProperties = getLayerProperties(layer);
    // console.log((layerProperties.textProperties));
    // console.log(layerProperties?.textProperties?.EngineDict?.ParagraphRun?.RunArray[0] || {});
    
    /*
    If text contains multiple lines, but each line has distinctly different style, then we split each line
    Otherwise, we just consider it to be like a single paragraph text
    */
    if(areMultipleTextLinesIdentical(layerProperties)) {
        let parsedLayer = { type: "text" };
        parsedLayer.i = layerProperties.text;
        parsedLayer.ie = encodeURIComponent(Buffer.from(layerProperties.text).toString('base64'));

        //Positioning
        parsedLayer.lx = (layerProperties.left < 0 ? 0 : layerProperties.left);
        parsedLayer.ly = (layerProperties.top < 0 ? 0 : layerProperties.top);
        
        //Opacity
        let opacity = Math.round((layerProperties.opacity / 255) * 10);
        if (opacity > 0 && opacity < 10) {
            parsedLayer.al = opacity;
        }

        //Attributes
        parsedLayer.fs = getFontSizeFromLayer(layerProperties, 0);
        parsedLayer.co = getFontColorFromLayer(layerProperties, 0);
        parsedLayer.ff = getFontFaceFromLayer(layerProperties, 0, originalFonts);
        parsedLayer.ia = getInternalAlignmentFromLayer(layerProperties, 0);
        
        //Not adding width in text layer for now because of potential 
        //issues because of different font being available than the one in PSD
        //which would mean the font that gets used in the layer might take up
        //more or less width than what is obtained from PSD
        //parsedLayer.w = Math.abs(layerProperties.right - layerProperties.left) + 1;
        
        parsedLayer.rt = getRotationAngle(layerProperties);

        parsedLayers.splice(0, 0, parsedLayer);
    } else {
        let textSplit = layerProperties.text.split("\r");
        for (let i = 0; i < textSplit.length; i++) {
            if (textSplit[i].length) {
                let parsedLayer = { type: "text" };
                parsedLayer.i = textSplit[i];
                parsedLayer.ie = encodeURIComponent(Buffer.from(textSplit[i]).toString('base64'));

                //Positioning
                parsedLayer.lx = (layerProperties.left < 0 ? 0 : layerProperties.left);
                if (i == 0) {
                    parsedLayer.ly = (layerProperties.top < 0 ? 0 : layerProperties.top);
                } else {
                    let lineHeight = getLineHeight(layerProperties, i);
                    parsedLayer.ly = layerProperties.top + lineHeight * i;
                }

                //Opacity
                let opacity = Math.round((layerProperties.opacity / 255) * 10);
                if (opacity > 0 && opacity < 10) {
                    parsedLayer.al = opacity;
                }

                //Attributes
                parsedLayer.fs = getFontSizeFromLayer(layerProperties, i);
                parsedLayer.co = getFontColorFromLayer(layerProperties, i);
                parsedLayer.ff = getFontFaceFromLayer(layerProperties, i, originalFonts);
                parsedLayer.ia = getInternalAlignmentFromLayer(layerProperties, i);

                parsedLayer.rt = getRotationAngle(layerProperties);

                parsedLayers.splice(0, 0, parsedLayer);
            }
        }
    }
    
    return parsedLayers;
}

async function processImageLayer(layer, parsedLayers, data) {
    let parsedLayer = { type : "image" };
    
    let layerProperties = layer?.layerFrame?.layerProperties;
    if(!layerProperties) return parsedLayer;

    let fileName = (layer?.layerFrame?.layerProperties.name || Math.random()) .replace(/[^a-z0-9]/gi, '_').toLowerCase() + "_" + layer?.layerFrame?.layerProperties.groupId +  ".png";
    parsedLayer.i = data.OUTPUT_DIR + "@@" + fileName;
    
    //Position
    parsedLayer.lx = (layerProperties.left < 0 ? 0 : layerProperties.left);
    parsedLayer.ly = (layerProperties.top < 0 ? 0 : layerProperties.top);
    
    //Default needed
    parsedLayer.t = "false";

    //resizing and cropping
    let layerWidth = Math.abs(layerProperties.right - layerProperties.left) + 1;
    let layerHeight = Math.abs(layerProperties.bottom - layerProperties.top) + 1;

    let width = layerWidth, height = layerHeight, x = 0, y = 0, cropMode = "";
    //Crop the image to keep it correctly in bounds
    if(width > data.canvasWidth) {
        width = data.canvasWidth;
        x = Math.abs(0 - Math.abs(layerProperties.left));
        cropMode = "extract"
        if (layerProperties.left < 0 && layerProperties.right > data.canvasWidth) {
            x = Math.abs(0 - Math.abs(layerProperties.left));
            width = data.canvasWidth;
            cropMode = "extract"
        } else if (layerProperties.left < 0 && layerProperties.right < data.canvasWidth) {
            x = Math.abs(0 - Math.abs(layerProperties.left));
            width = layerWidth - x; 
            cropMode = "extract"
        } else if(layerProperties.right > data.canvasWidth) {
            width = Math.abs(data.canvasWidth - layerProperties.left);
            cropMode = "extract"
        }
    } else {
        
        if (layerProperties.left < 0) {
            x = Math.abs(0 - Math.abs(layerProperties.left));
            width = layerWidth - x;
            cropMode = "extract"
        } else if(layerProperties.right > data.canvasWidth) {
            width = Math.abs(data.canvasWidth - layerProperties.left);
            cropMode = "extract"
        }
    }
    parsedLayer.w = width;
    parsedLayer.x = x;
    
    if(height > data.canvasHeight) {
        if (layerProperties.top < 0 && layerProperties.bottom > data.canvasHeight) {
            y = Math.abs(0 - Math.abs(layerProperties.top));
            height = data.canvasHeight; 
            cropMode = "extract"
        } else if (layerProperties.top < 0 && layerProperties.bottom < data.canvasHeight) {
            y = Math.abs(0 - Math.abs(layerProperties.top));
            height = layerHeight - y; 
            cropMode = "extract"
        } else if(layerProperties.bottom > data.canvasHeight) {
            height = Math.abs(data.canvasHeight - layerProperties.top);
            cropMode = "extract"
        }
    } else {
        if (layerProperties.top < 0) {
            y = Math.abs(0 - Math.abs(layerProperties.top));
            height = layerHeight - y; 
            cropMode = "extract"
        } else if(layerProperties.bottom > data.canvasHeight) {
            height = Math.abs(data.canvasHeight - layerProperties.top);
            cropMode = "extract"
        }
    }
    parsedLayer.h = height;
    parsedLayer.y = y;

    if(cropMode) {
        parsedLayer.cm = cropMode;
    }

    // //Opacity is currently handled when we extract the image composite. But if that needs to change
    // Then this will be used
    // let opacity = Math.round((layerProperties.opacity / 255) * 100);
    // if (opacity > 0 && opacity < 100) {
    //   parsedLayer.o = opacity;
    // }

    parsedLayers.splice(0,0,parsedLayer);

    let filePath = "./" + data.OUTPUT_DIR + "/" + fileName
    await storeImageLocally(layer, layerWidth, layerHeight, filePath);
}

function getFontSizeFromLayer(layerProperties, textIndex) {
    let runArray = getRunArray(layerProperties, textIndex);
    let givenFontSize = runArray.StyleSheet.StyleSheetData.FontSize;
    let typeToolObjectSetting = layerProperties.additionalLayerProperties.TySh;

    return getActualFontSizeFromStyleData(givenFontSize, typeToolObjectSetting);
}

function getFontColorFromLayer(layerProperties, textIndex) {
    let runArray = getRunArray(layerProperties, textIndex);
    let givenFontColor = runArray.StyleSheet.StyleSheetData.FillColor;
    return rgbHex(Math.round(givenFontColor.Values[1] * 255), Math.round(givenFontColor.Values[2] * 255), Math.round(givenFontColor.Values[2]*255));

}

function getLineHeight(layerProperties, textIndex) {
    let runArray = getRunArray(layerProperties, textIndex);
    let typeToolObjectSetting = layerProperties.additionalLayerProperties.TySh;
    if(runArray.StyleSheet.StyleSheetData.AutoLeading == true) {
        return Math.round(getActualFontSizeFromStyleData(runArray.StyleSheet.StyleSheetData.FontSize, typeToolObjectSetting) * 1.2);
    } else {
        return Math.round(getActualFontSizeFromStyleData(runArray.StyleSheet.StyleSheetData.FontSize, typeToolObjectSetting) 
                + (runArray.StyleSheet.StyleSheetData.Leading/2));
    }
}

function getFontFaceFromLayer(layerProperties, textIndex, originalFonts) {
    let runArray = getRunArray(layerProperties, textIndex);
    let availableFonts = layerProperties.textProperties.DocumentResources.FontSet;
    let currentLayerFont = availableFonts[runArray.StyleSheet.StyleSheetData.Font];
    return getFontPath(currentLayerFont.Name, originalFonts);
}

function getInternalAlignmentFromLayer(layerProperties, textIndex) {
    let runArray = getParagraphRunArray(layerProperties, textIndex);
    let justification = runArray?.ParagraphSheet?.Properties?.Justification || 0;

    if(justification == 0) {
        return "left";
    } else if (justification == 1) {
        return "right";
    } else {
        return "center";
    }
}

function getRunArray(layerProperties, index) {
    return layerProperties?.textProperties?.EngineDict?.StyleRun?.RunArray[index] || layerProperties?.textProperties?.EngineDict?.StyleRun?.RunArray[0] || {};
}

function getParagraphRunArray(layerProperties, index) {
    return layerProperties?.textProperties?.EngineDict?.ParagraphRun?.RunArray[index] || layerProperties?.textProperties?.EngineDict?.ParagraphRun?.RunArray[0] || {};
}

function getActualFontSizeFromStyleData(givenFontSize, typeToolObjectSetting) {
    const scalingFactor = Math.sqrt(typeToolObjectSetting.transformXX ** 2 + typeToolObjectSetting.transformYX ** 2);

    return Math.round(givenFontSize * scalingFactor)
}

// Function to calculate clockwise rotation from a transformation matrix
function getRotationAngle(layerProperties) {
    let typeToolObjectSetting = layerProperties.additionalLayerProperties.TySh;

    // Calculate the angle in radians
    const radians = Math.atan2(typeToolObjectSetting.transformYX, typeToolObjectSetting.transformXX);
    
    // Convert to degrees
    const degrees = radians * (180 / Math.PI);

    // Clockwise rotation is the negative of the calculated angle
    return "N" + Math.round(degrees);
}


function areMultipleTextLinesIdentical(layerProperties) {
    // Access the RunArray
    const runArray = layerProperties?.textProperties?.EngineDict?.StyleRun?.RunArray;

    // If RunArray is undefined or empty, return false
    if (!Array.isArray(runArray) || runArray.length === 0) {
        return false;
    }

    // Extract the first index's properties to compare against
    const firstFontSize = runArray[0]?.StyleSheet?.StyleSheetData?.FontSize;
    const firstFontColor = JSON.stringify(runArray[0]?.StyleSheet?.StyleSheetData?.FillColor); // Stringify to compare objects
    const firstFont = runArray[0]?.StyleSheet?.StyleSheetData?.Font;

    // Iterate through all indexes in RunArray
    for (let i = 1; i < runArray.length; i++) {
        const currentFontSize = runArray[i]?.StyleSheet?.StyleSheetData?.FontSize;
        const currentFontColor = JSON.stringify(runArray[i]?.StyleSheet?.StyleSheetData?.FillColor);
        const currentFont = runArray[i]?.StyleSheet?.StyleSheetData?.Font;
        
        // Compare values with the first index
        if (
            currentFontSize !== firstFontSize ||
            currentFontColor !== firstFontColor ||
            currentFont !== firstFont
        ) {
            return false;
        }
    }

    return true;
}

function getFontPath(fontFace, originalFonts) {
    let fontName = (fontFace).replace(/[\W_]+/g,"");
    
    if(!originalFonts[fontName]) {
        originalFonts[fontName] = 1;
    }

    if(fonts.FONT_NAME_ALIASES[fontName]) {
        fontName = fonts.FONT_NAME_ALIASES[fontName]
    }

    for(var i in fonts.FONTS_INSTALLED) {
        if(i.split(".")[0] === fontName || i === fontName) {
            return [fonts.FONT_DIR, i].join("@@")
        }
    }

    return [fonts.FONT_DIR, fonts.DEFAULT_FONT].join("@@")
}

async function storeImageLocally(layer, layerWidth, layerHeight, filePath) {
    let layerPixelData = await layer.composite();
    let options = {
        width : layerWidth,
        height : layerHeight,
        channels : 4
    };

    await new sharp(layerPixelData, {
        raw : options
    }).toFile(filePath);
}

export {
    isLayerHidden,
    getLayerProperties,
    processTextLayer,
    processImageLayer
}