const FONT_DIR = "tneufonts";
const DEFAULT_FONT = "ProximaNovaRegular.otf";
const FONTS_INSTALLED = {
  "PTSansBold.ttf" : 1,
  "PTSansRegular.ttf": 1,
  "ProximaNovaRegular.otf" : 1,
  "ProximaNovaABold.otf" : 1
}

/*
  Fonts have been found to have slightly different names in different PSD files
  Instead of duplicating these font names in the Media Library, creating an alias here to map the font name in PSD to the
  font installed/available in the Media Library
  You can either choose to upload the font file with the new name and add it to FONTS_INSTALLED, or you can choose to map the 
  name to one of the existing FONTS_INSTALLED
*/
const FONT_NAME_ALIASES = {
  "ProximaNovaBold" : "ProximaNovaABold.otf"
};

export {
  FONT_DIR,
  DEFAULT_FONT,
  FONTS_INSTALLED,
  FONT_NAME_ALIASES
}