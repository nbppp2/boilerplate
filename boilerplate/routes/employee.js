'use strict';

const express = require('express');
const router = express.Router();
const uuidv4 = require('uuid/v4');
var request = require('request-promise');

const DATABASE = {};

// GET employees listing.
router.get('', function(req, res) {
  return res.send(DATABASE);
});

// GET employee by ID
router.get('/:id', function (req, res) {
  const employeeId = req.param('id');
  lookupEmployee(employeeId).then((employee) => {
    return res.send(200, employee);
  })
  .catch((errorMessage) => {
    return handleError(res, errorMessage, 403);
  })
});

// DELETE an Employee from the DATABASE by ID
router.delete('/:id', function (req, res) {
  const employeeId = req.param('id');
  lookupEmployee(employeeId).then((employee) => {
    delete DATABASE[employeeId];
    return res.send(200);
  })
  .catch((errorMessage) => {
    return handleError(res, errorMessage, 403);
  })
});

// POST a new EMPLOYEE to the DATABASE as long as all checks pass
router.post('', function (req, res) {
  validateReqBody(req.body).then((employee) => {

    const employeeId = uuidv4();
    let picture = getPictureUrl();
    let quote = getQuote();

    Promise.all([picture, quote]).then(() => {
      // TODO retry calls after a short wait
      }).catch(() => {
        // FIXME
        // Silently swallow errors
        // currently code should never get here
      }).finally(() => {
        DATABASE[employeeId] = employee;
        return res.send(200);
      })

    // helper functions for external API
    // TODO add functionality to make sure names are handled in a case insensitive manner
    // ie if input is John Smith it will be transformed to JOHN SMITH
    function getPictureUrl(){
      // generate random number between 1-993
      // https://picsum.photos/v2/list?page=993&limit=1
      // [{"id":"999","author":"Annie Spratt","width":4000,"height":2667,"url":"https://unsplash.com/photos/R3LcfTvcGWY","download_url":"https://picsum.photos/id/999/4000/2667"}]
      // Pull ID out of data.
      // https://picsum.photos/id/:id/450 // generate URL and add it to employee data

      /*
      * magic numbers FIXME
      *
      * maxRecordNum - calls to the service with numbers higher than this will return an empty array.
      * imageSize - the image will be retrived at this size
      */
      const maxRecordNum = 994;
      const imageSize = 450;
      const randPageNum = Math.floor(Math.random() * Math.floor(maxRecordNum));
      const imageInfoUrl = `https://picsum.photos/v2/list?page=${randPageNum}&limit=1`

      return new Promise((resolve, reject) => {
        request({uri: imageInfoUrl, json: true})
        .then((imageInfo) => {
          resolve(`https://picsum.photos/id/${imageInfo.id}/${imageSize}`)
        })
        .catch((error) => {
          // silently swallow error FIXME
          resolve(null);
        })
      })
    };

    // get inspirational quote from API. Add it as part of employee data
    function getQuote(){
      return new Promise((resolve, reject) => {
        request("https://quotes.rest/qod")
        .then((quote) => {
          resolve(quote)
        })
        .catch((error) => {
          // silently swallow error FIXME
          resolve(null);
        })
      })
    };
  }).catch((error) => {
    handleError(
      res,
      "Unable to save new employee\n" + error.message,
      error.statusCode)
  })
});

// PUT new EMPLOYEE information in the DATABASE by ID
router.put('/:id', function (req, res) {
  const employeeId = req.param('id');
  lookupEmployee(employeeId).then((oldEmployeeData) => {
    validateReqBody(req.body)
    .then((newEmployeeData) => {
      DATABASE[employeeId] = newEmployeeData;
      return res.send(200, newEmployeeData);
    }).catch((error) => {
      return handleError(
        res,
        `Unable to update employee ${employeeId}.\n` + error.message,
        error.statusCode
      );
    })
  }).catch((errorMessage) => {
      return handleError(res, errorMessage, 403);
    })
});

/**
 *
 * @param {String} id
 * @returns {Promise}
 *
 * Returns an employee if found, error if not
 */
function lookupEmployee(id){
  return new Promise((resolve, reject) => {
    const employee = DATABASE[id];
    if (employee) {
      resolve(employee);
    } else {
      reject("No employee with this ID has been found")
    }
  })
}

/**
 *
 * @param {Object} reqBody - The request body that needs to be checked
 * @returns {Promise}
 *
 * This checks the request body for all required fields and makes sure those fields have valid data
 */
function validateReqBody(reqBody){
  return new Promise((resolve, reject) => {

    const requiredKeys = [
      "firstName",
      "lastName",
      "hireDate",
      "role"
    ];

    const rolesEnum = [
      "CEO",
      "VP",
      "MANAGER",
      "INDIVIDUAL CONTRIBUTOR"
    ];

    const stdError = {
      message: "You must include all required fields in your request",
      statusCode: 400
    };

    // validate that the request has employee object
    if (reqBody.constructor !== Object
      || Object.keys(reqBody).length === 0
      || !reqBody.employee
      || reqBody.employee.constructor !== Object
      || Object.keys(reqBody.employee).length === 0)
    {
      reject(stdError);
    } else {
      const employee = reqBody.employee;
      const requestEmployeeKeys = Object.keys(reqBody.employee);

      // check that all fields exist
      // TODO make sure that fields have values of the correct type ie firstName not a boolean
      requiredKeys.forEach(key => {
        if (!requestEmployeeKeys.includes(key)) {
          reject(stdError);
        }
      });
      // check roles
      if (!rolesEnum.includes(employee.role.toString().toUpperCase())) {
        reject({
          message: `The value for role must be one of ${rolesEnum}`,
          statusCode: 400
        });
      }
      // final check
      try{
        if(Date.parse(employee.hireDate) > Date.now()){
          reject({
            message: "Date must be in the past",
            statusCode: 400
          })
        }
      }catch(dateError){
        reject({
          message: "Hire date must be in the format of YYYY-MM-DD",
          statusCode: 400
        })
      }
      resolve(employee);
    }
  })
};

/**
 *
 * @param {Object} res
 * @param {String} message
 * @param {Number} statusCode
 */
function handleError(res, message, statusCode) {
  statusCode = statusCode || 500;
  return res.send(statusCode, {message: message});
};

module.exports = router;
