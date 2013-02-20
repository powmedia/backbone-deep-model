#Running tests
Please make sure all tests pass before submitting pull requests.

To run tests, open the test/index.html file in a browser. You can now make changes to src/deep-model.js and reload the page to run tests.

Before submitting, you should build the distribution files (see below) and run test/distribution.html to double check everything is still OK.


#Building the distribution files (e.g. deep-model.min.js)

Node.JS is required. See http://nodejs.org/ to install.

Open a terminal and `cd` to the main folder.  Then run this command to install required modules:

  npm install

Now you can run the build script to create the distribution files:

  ./scripts/build

You can also run the following script to automatically build the files when a change is made. This is useful for running the tests.

  ./scripts/watch
