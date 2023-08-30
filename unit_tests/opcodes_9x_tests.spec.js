'use strict';
const expect = require('chai').expect;
const winston = require('./config/winston_test.js');
const itParam = require('mocha-param');
const net = require('net')
const cbusLib = require('cbuslibrary');
const Mock_Cbus = require('./mock_CbusNetwork.js')
const IP_Network = require('./../ip_network.js')
const opcodes_9x = require('./../Test_cases/opcodes_9x.js');
const RetrievedValues = require('./../RetrievedValues.js');
const utils = require('./../utilities.js');
const { brotliCompressSync } = require('zlib');
const assert = require('chai').assert;

// Scope:
// variables declared outside of the class are 'global' to this module only
// callbacks need a bind(this) option to allow access to the class members
// let has block scope (or global if top level)
// var has function scope (or global if top level)
// const has block sscope (like let), and can't be changed through reassigment or redeclared

const NET_PORT = 5569;			// 5560 + opcode catagory offset
const NET_ADDRESS = "127.0.0.1"


describe('opcodes_9x unit tests', function(){
	const mock_Cbus = new Mock_Cbus(NET_PORT);
	const Network = new IP_Network(NET_ADDRESS, NET_PORT);
	const tests = new opcodes_9x(Network);


    // mns_testss have their own timeouts, so need to reflect that and add a little bit
    // to ensure the unti tests don't timeout first
    const test_timeout = tests.response_time + 100;

	before(function() {
    utils.DisplayUnitTestHeader('opcodes_9x unit tests');
    Network.testStarted = true;
    tests.defaultTimeout = 10
  	})
    
    beforeEach (function() {
   		winston.info({message: ' '});   // blank line to separate tests
		Network.messagesIn = [];
    })

	after(function(done) {
        // bit of timing to ensure all winston messages get sent before closing tests completely
		setTimeout(function(){
      // timeout to allow tests to print
      winston.debug({message: 'UNIT TEST: RetrievedValues \n' + JSON.stringify(RetrievedValues.data, null, "    ")});
      utils.DisplayUnitTestFooter('opcodes_9x unit tests finished');
      setTimeout(function(){
        // timeout to allow the finish text above to print
        done();
      }, 100);
		}, 100);
  });


  ///////////////////////////////////////////////////////////////////////////////
  //
  // 				Tests
  //

  function GetTestCase_NodeAndEvent() {
    var arg1, arg2, arg3, testCases = [];
    for (var a = 1; a<= 4; a++) {
      if (a == 1) {arg1 = 0, arg3 = true}
      if (a == 2) {arg1 = 1, arg3 = true}
      if (a == 3) {arg1 = 65535, arg3 = true}
      if (a == 4) {arg1 = 2, arg3 = false}
      for (var b = 1; b < 4; b++) {
        if (b == 1) {arg2 = 0}
        if (b == 2) {arg2 = 1}
        if (b == 3) {arg2 = 65535}
        testCases.push({'nodeNumber':arg1, 'eventNumber':arg2, 'expectedResult':arg3});
      }
    }
    return testCases;
  }

  function GetTestCase_eventIdentifier() {
    var arg1, arg2, arg3, testCases = [];
    for (var a = 1; a<= 4; a++) {
      if (a == 1) {arg1 = 0, arg3 = true}
      if (a == 2) {arg1 = 1, arg3 = true}
      if (a == 3) {arg1 = 65535, arg3 = true}
      if (a == 4) {arg1 = 2, arg3 = false}
      for (var b = 1; b< 5; b++) {
        if (b == 1) {arg2 = "00000000"}
        if (b == 2) {arg2 = "00000001"}
        if (b == 3) {arg2 = "00010000"}
        if (b == 4) {arg2 = "FFFFFFFF"}
        testCases.push({ 'nodeNumber':arg1, 'eventIdentifier':arg2, 'expectedResult':arg3 });
      }
    }
    return testCases;
  }

  // Used where an opcode returns both a CMDERR and a GRSP on a fault
  //
  function GetTestCase_DoubleFaultCode() {
    var arg1, arg2, testCases = [];
    for (var a = 1; a<= 7; a++) {
      if (a == 1) {arg1 = 0, arg2 = true}
      if (a == 2) {arg1 = 1, arg2 = false}
      if (a == 3) {arg1 = 2, arg2 = false}
      if (a == 4) {arg1 = 3, arg2 = false}
      if (a == 5) {arg1 = 4, arg2 = false}
      if (a == 6) {arg1 = 5, arg2 = false}
      if (a == 7) {arg1 = 6, arg2 = false}
      testCases.push({ 'testOption':arg1, 'expectedResult':arg2 });
    }
    return testCases;
  }

  // 0x92 - AREQ
  itParam("AREQ test ${JSON.stringify(value)}", GetTestCase_NodeAndEvent(), async function (value) {
    winston.info({message: 'UNIT TEST:: BEGIN AREQ test ' + JSON.stringify(value)});
    var result = await tests.test_AREQ(RetrievedValues, value.nodeNumber, value.eventNumber);
    expect(result).to.equal(true);  
    expect(tests.hasTestPassed).to.equal(true);  
    winston.info({message: 'UNIT TEST: AREQ ended'});
  })

    
  // 0x95 - EVULN
  itParam("EVULN test ${JSON.stringify(value)}", GetTestCase_eventIdentifier(), async function (value) {
    winston.info({message: 'UNIT TEST:: BEGIN EVULN test ' + JSON.stringify(value)});
		RetrievedValues.setNodeNumber(value.nodeNumber);
    if (value.expectedResult == true) { mock_Cbus.learningNode = value.nodeNumber }
    var result = await tests.test_EVULN(RetrievedValues, value.eventIdentifier);
    expect(result).to.equal(value.expectedResult);
    expect(tests.hasTestPassed).to.equal(value.expectedResult);
    winston.info({message: 'UNIT TEST: EVULN ended'});
  })

    
  // 0x95 - EVULN
  itParam("EVULN_INVALID_EVENT test ${JSON.stringify(value)}", GetTestCase_DoubleFaultCode(), async function (value) {
    winston.info({message: 'UNIT TEST:: BEGIN EVULN_INVALID_EVENT test'});
		RetrievedValues.setNodeNumber(1);
    mock_Cbus.learningNode = 1;
    mock_Cbus.testOption = value.testOption
    var result = await tests.test_EVULN_INVALID_EVENT(RetrievedValues, "FFF0FFF0");
    expect(result).to.equal(value.expectedResult);  
    expect(tests.hasTestPassed).to.equal(value.expectedResult);  
    winston.info({message: 'UNIT TEST: EVULN_INVALID_EVENT ended'});
  })

  
  // 0x95 - EVULN
  it("EVULN_SHORT test", async function () {
    winston.info({message: 'UNIT TEST:: BEGIN EVULN_SHORT test'});
		RetrievedValues.setNodeNumber(1);
    mock_Cbus.learningNode = 1;
    var result = await tests.test_EVULN_SHORT(RetrievedValues, "00010001");
    expect(result).to.equal(true);  
    expect(tests.hasTestPassed).to.equal(true);  
    winston.info({message: 'UNIT TEST: EVULN_SHORT ended'});
  })

    
  function GetTestCase_NVSET() {
    var arg1, arg2, arg3, arg4, testCases = [];
    for (var a = 1; a<= 4; a++) {
      if (a == 1) {arg1 = 0, arg4 = true}
      if (a == 2) {arg1 = 1, arg4 = true}
      if (a == 3) {arg1 = 65535, arg4 = true}
      if (a == 4) {arg1 = 2, arg4 = false}
      for (var b = 1; b < 4; b++) {
        if (b == 1) {arg2 = 0}
        if (b == 2) {arg2 = 1}
        if (b == 3) {arg2 = 2}
        for (var c = 1; c < 4; c++) {
          if (c == 1) {arg3 = 0}
          if (c == 2) {arg3 = 1}
          if (c == 3) {arg3 = 2}
          testCases.push({ 'nodeNumber':arg1, 'nodeVariableIndex':arg2, 'nodeVariableValue': arg3, 'expectedResult':arg4 });
        }
      }
    }
    return testCases;
  }

  // 0x96 - NVSET
  // Format: [<MjPri><MinPri=3><CANID>]<96><NN hi><NN lo><NV# ><NV val>
  itParam("NVSET test ${JSON.stringify(value)}", GetTestCase_NVSET(), async function (value) {
    winston.info({message: 'UNIT TEST:: BEGIN NVSET test ' + JSON.stringify(value)});
    RetrievedValues.setNodeNumber(value.nodeNumber);
    var result = await tests.test_NVSET(RetrievedValues, value.nodeVariableIndex, value.nodeVariableValue);
    expect(result).to.equal(value.expectedResult);
    expect(tests.hasTestPassed).to.equal(value.expectedResult);
    winston.info({message: 'UNIT TEST: NVSET ended'});
  })

  
  // 0x96 - NVSET
  // Format: [<MjPri><MinPri=3><CANID>]<96><NN hi><NN lo><NV# ><NV val>
  it("NVSET_INVALID_INDEX", async function () {
    winston.info({message: 'UNIT TEST:: BEGIN NVSET_INVALID_INDEX test'});
    RetrievedValues.setNodeNumber(0);
    var result = await tests.test_NVSET_INVALID_INDEX(RetrievedValues, 255, 0);
    expect(result).to.equal(true);  
    expect(tests.hasTestPassed).to.equal(true);  
    winston.info({message: 'UNIT TEST: NVSET_INVALID_INDEX ended'});
  })


  // 0x96 - NVSET
  // Format: [<MjPri><MinPri=3><CANID>]<96><NN hi><NN lo><NV# ><NV val>
  it("NVSET_SHORT", async function () {
    winston.info({message: 'UNIT TEST:: BEGIN NVSET_SHORT test'});
    RetrievedValues.setNodeNumber(0);
    var result = await tests.test_NVSET_SHORT(RetrievedValues, 1, 0);
    expect(result).to.equal(true);  
    expect(tests.hasTestPassed).to.equal(true);  
    winston.info({message: 'UNIT TEST: NVSET_SHORT ended'});
  })


  // 0x9A - ASRQ
  itParam("ASRQ test ${JSON.stringify(value)}", GetTestCase_NodeAndEvent(), async function (value) {
    winston.info({message: 'UNIT TEST:: BEGIN ASRQ test ' + JSON.stringify(value)});
    var result = await tests.test_ASRQ(RetrievedValues, value.nodeNumber, value.eventNumber);
    expect(result).to.equal(value.expectedResult);
    expect(tests.hasTestPassed).to.equal(value.expectedResult);
    winston.info({message: 'UNIT TEST: ASRQ ended'});
  })

    
})

