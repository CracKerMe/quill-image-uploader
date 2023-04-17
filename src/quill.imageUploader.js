/* eslint-disable no-param-reassign */
/* eslint-disable no-prototype-builtins */
/* eslint-disable no-plusplus */
/* eslint-disable no-console */
// eslint-disable-next-line import/extensions
import LoadingImage from './blots/image.js';

import './quill.imageUploader.css';

class ImageUploader {
  constructor(quill, options) {
    this.quill = quill;
    this.fromPaste = false;
    this.options = options;
    this.range = null;
    this.placeholderDelta = null;

    if (typeof this.options.upload !== 'function') {
      console.warn(
        '[Missing config] upload function that returns a promise is required',
      );
    }

    const toolbar = this.quill.getModule('toolbar');
    if (toolbar) {
      toolbar.addHandler('image', this.selectLocalImage.bind(this));
    }

    this.handleDrop = this.handleDrop.bind(this);
    this.handlePaste = this.handlePaste.bind(this);

    this.quill.root.addEventListener('drop', this.handleDrop, false);
    this.quill.root.addEventListener('paste', this.handlePaste, false);
  }

  selectLocalImage() {
    this.quill.focus();
    this.range = this.quill.getSelection();
    this.fileHolder = document.createElement('input');
    this.fileHolder.setAttribute('type', 'file');
    this.fileHolder.setAttribute('accept', 'image/*');
    this.fileHolder.setAttribute('style', 'visibility:hidden');

    this.fileHolder.onchange = this.fileChanged.bind(this);

    document.body.appendChild(this.fileHolder);

    this.fileHolder.click();

    window.requestAnimationFrame(() => {
      document.body.removeChild(this.fileHolder);
    });
  }

  handleDrop(evt) {
    if (
      evt.dataTransfer
      && evt.dataTransfer.files
      && evt.dataTransfer.files.length
    ) {
      evt.stopPropagation();
      evt.preventDefault();
      if (document.caretRangeFromPoint) {
        const selection = document.getSelection();
        const range = document.caretRangeFromPoint(evt.clientX, evt.clientY);
        if (selection && range) {
          selection.setBaseAndExtent(
            range.startContainer,
            range.startOffset,
            range.startContainer,
            range.startOffset,
          );
        }
      } else {
        const selection = document.getSelection();
        const range = document.caretPositionFromPoint(evt.clientX, evt.clientY);
        if (selection && range) {
          selection.setBaseAndExtent(
            range.offsetNode,
            range.offset,
            range.offsetNode,
            range.offset,
          );
        }
      }

      this.quill.focus();
      this.range = this.quill.getSelection();
      const file = evt.dataTransfer.files[0];

      setTimeout(() => {
        this.fromPaste = true;
        this.quill.focus();
        this.range = this.quill.getSelection();
        this.readAndUploadFile(file);
      }, 0);
    }
  }

  handlePaste(evt) {
    const clipboard = evt.clipboardData || window.clipboardData;

    // IE 11 is .files other browsers are .items
    if (clipboard && (clipboard.items || clipboard.files)) {
      const items = clipboard.items || clipboard.files;
      const IMAGE_MIME_REGEX = /^image\/(jpe?g|gif|png|svg|webp)$/i;

      const oneFile = items[0];
      if (IMAGE_MIME_REGEX.test(oneFile.type)) {
        const file = oneFile.getAsFile ? oneFile.getAsFile() : oneFile;

        if (file) {
          this.quill.focus();
          this.range = this.quill.getSelection();
          evt.preventDefault();
          setTimeout(() => {
            this.fromPaste = true;
            this.quill.focus();
            this.range = this.quill.getSelection();
            this.readAndUploadFile(file);
          }, 0);
        }
      }
    }
  }

  readAndUploadFile(file) {
    let isUploadReject = false;

    const fileReader = new FileReader();

    fileReader.addEventListener(
      'load',
      () => {
        if (!isUploadReject) {
          const base64ImageSrc = fileReader.result;
          this.insertBase64Image(base64ImageSrc);
        }
      },
      false,
    );

    if (file) {
      fileReader.readAsDataURL(file);
    }

    this.options.upload(file).then(
      (imageUrl) => {
        if (!imageUrl) return;
        this.insertToEditor(imageUrl);
      },
      (error) => {
        isUploadReject = true;
        this.removeBase64Image();
        console.warn(error);
      },
    );
  }

  fileChanged() {
    const file = this.fileHolder.files[0];
    this.readAndUploadFile(file);
  }

  insertBase64Image(url) {
    const { range } = this;

    this.placeholderDelta = this.quill.insertEmbed(
      range.index,
      LoadingImage.blotName,
      `${url}`,
      'user',
    );
  }

  insertToEditor(url) {
    const { range } = this;

    const lengthToDelete = this.calculatePlaceholderInsertLength();

    // Delete the placeholder image
    this.quill.deleteText(range.index, lengthToDelete, 'user');
    // Insert the server saved image
    this.quill.insertEmbed(range.index, 'image', `${url}`, 'user');

    range.index++;
    this.quill.setSelection(range, 'user');
    if (this.fromPaste) {
      this.fromPaste = false;
      this.removeBase64Image();
    }
  }

  // eslint-disable-next-line max-len
  // The length of the insert delta from insertBase64Image can vary depending on what part of the line the insert occurs
  calculatePlaceholderInsertLength() {
    if (this.placeholderDelta && this.placeholderDelta.ops) {
      return this.placeholderDelta.ops.reduce((accumulator, deltaOperation) => {
        if (deltaOperation.hasOwnProperty('insert')) accumulator++;

        return accumulator;
      }, 0);
    }
    return 0;
  }

  removeBase64Image() {
    const { range } = this;
    const lengthToDelete = this.calculatePlaceholderInsertLength();

    if (lengthToDelete > 0) {
      this.quill.deleteText(range.index, lengthToDelete, 'user');
    }
  }
}

window.ImageUploader = ImageUploader;
export default ImageUploader;
