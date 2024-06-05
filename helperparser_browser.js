//runArray, StyleDict reasoning here - https://github.com/webtoon/psd/issues/64

import rgbHex from 'rgb-hex';
// import sharp from 'sharp';
import * as fonts from "./fonts.js";
import { encode } from 'js-base64';

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

    let textSplit = layerProperties.text.split("\r");
    for(let i = 0; i < textSplit.length; i++) {
        if(textSplit[i].length) {
            let parsedLayer = { type : "text" };
            parsedLayer.i = textSplit[i];     
            parsedLayer.ie = encodeURIComponent(encode(textSplit[i]));

            //Positioning
            parsedLayer.lx = (layerProperties.left < 0 ? 0 : layerProperties.left);
            if(i == 0) {
                parsedLayer.ly = (layerProperties.top < 0 ? 0 : layerProperties.top);
            } else {
                let lineHeight = getLineHeight(layerProperties, i);
                parsedLayer.ly = layerProperties.top + lineHeight*i;
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

            parsedLayers.splice(0,0,parsedLayer);
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

    let width = layerWidth, height = layerHeight, x = 0, y = 0;
    if(width > data.canvasWidth) {
        width = data.canvasWidth;
        x = Math.abs(0 - Math.abs(layerProperties.left));
    }
    parsedLayer.w = width;
    parsedLayer.x = x;
    
    if(height > data.canvasHeight) {
        height = data.canvasHeight;
        y = Math.abs(0 - Math.abs(layerProperties.top));
    }
    parsedLayer.h = height;
    parsedLayer.y = y;

    if(x > 0 || y > 0) {
        parsedLayer.cm = "extract";
    }

    // //Opacity is currently handled when we extract the image composite. But if that needs to change
    // Then this will be used
    // let opacity = Math.round((layerProperties.opacity / 255) * 100);
    // if (opacity > 0 && opacity < 100) {
    //   parsedLayer.o = opacity;
    // }

    parsedLayers.splice(0,0,parsedLayer);

    // let filePath = "./" + data.OUTPUT_DIR + "/" + fileName
    // await storeImageLocally(layer, layerWidth, layerHeight, filePath);
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
    return Math.round(givenFontSize * ((typeToolObjectSetting.transformXX + typeToolObjectSetting.transformYY)/2))
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

export {
    isLayerHidden,
    getLayerProperties,
    processTextLayer,
    processImageLayer
}