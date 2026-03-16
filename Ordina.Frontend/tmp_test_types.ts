import { useDropzone } from "react-dropzone";

const onDrop = (acceptedFiles: File[]) => {};

// Attempt 1: original (might error depending on environment)
const options1 = {
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
    maxFiles: 1,
    maxSize: 1024,
    disabled: false,
    onDropRejected: () => {},
};

// @ts-expect-error - if it errors, we want to see it, but here we want to see if it fails tsc
const { getRootProps: getRootProps1 } = useDropzone(options1);

// Attempt 2: with undefined
const options2 = {
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
    maxFiles: 1,
    maxSize: 1024,
    disabled: false,
    onDropRejected: () => {},
    multiple: undefined,
    onDragEnter: undefined,
    onDragOver: undefined,
    onDragLeave: undefined,
};

const { getRootProps: getRootProps2 } = useDropzone(options2);

// Attempt 3: with cast
const { getRootProps: getRootProps3 } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
    maxFiles: 1,
    maxSize: 1024,
    disabled: false,
    onDropRejected: () => {},
} as any);
