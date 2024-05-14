# Configuration
Change the values in the config.js file from your ImageKit account. The white canvas file can be downloaded from this URL https://ik.imagekit.io/ikmedia/white-canvas.jpeg?tr=orig-true and placed in your own ImageKit Media Library at the root. Get the file URL of this white canvas file from your account and update it in the config against CANVAS_FILE property without any other query or transformation parameters.

# Setting up fonts
All fonts that are used in your PSD files should be uploaded to a specific folder in your ImageKit Media Library. This folder name is controlled by `FONT_DIR` in fonts.js. Fonts need to be manually uploaded once to this folder you specify here as they are not uploaded as a part of PSD parsing.

Once fonts are uploaded, you need to add their exact names in `FONTS_INSTALLED` map in fonts.js file. Only when you add a font installed here, will it get used in PSD parsing. Otherwise, ImageKit will default to the font specified against `DEFAULT_FONT`. 

The font name that you upload in the designated folder in ImageKit media library should exactly match the font name used in the PSD file. Otherwise ImageKit has no way of knowing if the font in the PSD is the same as the font uploaded to the media library.

# Sample Commands

## Parse PSD to Transformed URL and also upload any images found in the PSD file for the layers URL to work
```
node newparser.js --file=<psdfilepath.psd> --upload-files=true
```

## Parse PSD to Transformed URL without uploading files again
```
node newparser.js --file=<psdfilepath.psd>
```


## Parse PSD and get only JSON output for the transforms
```
node newparser.js --file=<psdfilepath.psd> --output=json
```

## Provide transform string and get a JSON output from it
```
node newparser.js --mode=transformToJSON --transform=<transformation_string>
```
