'use strict';
const winston = require('winston');		// use config from root instance
const cbusLib = require('cbuslibrary');
const utils = require('./../utilities.js');


// Scope:
// variables declared outside of the class are 'global' to this module only
// callbacks need a bind(this) option to allow access to the class members
// let has block scope (or global if top level)
// var has function scope (or global if top level)
// const has block scope (like let), and can't be changed through reassigment or redeclared

//
//
//
function decToHex(num, len) {return parseInt(num).toString(16).toUpperCase().padStart(len, '0');}


class opcodes_5x {

    constructor(NETWORK) {
		//                        0123456789012345678901234567890123456789
		winston.debug({message:  '----------------- opcodes_5x Constructor'});
		
		this.network = NETWORK;
        this.hasTestPassed = false;
        this.inSetupMode = false;
        this.test_nodeNumber = 0;
        this.response_time = 100;
    }
	
	    //
    // get first instance of a received message with the specified mnemonic
    //
    getMessage(mnemonic){
        var message = undefined;
        for (var i=0; i<this.network.messagesIn.length; i++){
            message = this.network.messagesIn[i];
            if (message.mnemonic == mnemonic){
                winston.debug({message: 'VLCB: Found message ' + mnemonic});
                break;
            }
        }
        if (message == undefined){                 
            winston.debug({message: 'VLCB: No message found for' + mnemonic});
        }
        return message
    }

	// 0x50 RQNN
	checkForRQNN(RetrievedValues){
		this.hasTestPassed = false;
		var message = this.getMessage('RQNN');
			if (message != null) {
            if (message.mnemonic == "RQNN"){
                this.test_nodeNumber = message.nodeNumber;
				RetrievedValues.setNodeNumber( message.nodeNumber);
                this.inSetupMode = true;
				this.hasTestPassed = true;
                winston.info({message: 'VLCB:      module ' + this.test_nodeNumber + ' in setup mode '});
			}
		}

		if (this.hasTestPassed){ 
			utils.processResult(RetrievedValues, this.hasTestPassed, 'RQNN');
		}else{
			// in this instance, we're calling this method multiple times until we get an RQNN,
			// so don't mark each try as a fail - the upper layer will timeout and fail if didn't get a pass
			winston.info({message: 'VLCB: no RQNN received....'});
		}
		winston.debug({message: '-'});
	}


    // 0x5E - NNRST
    test_NNRST(RetrievedValues) {
        return new Promise(function (resolve, reject) {
            winston.debug({message: 'VLCB: BEGIN NNRST test'});
            this.hasTestPassed = false;
            this.network.messagesIn = [];
            var msgData = cbusLib.encodeNNRST(RetrievedValues.getNodeNumber());
            this.network.write(msgData);
            setTimeout(()=>{
                // get uptime diagnostic code from MNS service - but need to find serviceIndex for MNS first
                var serviceIndex
                for (var key in RetrievedValues.data["Services"]) {
                    var serviceType = RetrievedValues.data["Services"][key]["ServiceType"];
                    if (serviceType == 1 ) {
                        serviceIndex = RetrievedValues.data["Services"][key]["ServiceIndex"];
                    }
                }
                if (serviceIndex) {
                    // get all diagnostics for MNS service
                    var msgData = cbusLib.encodeRDGN(RetrievedValues.getNodeNumber(), serviceIndex, 0);
                    this.network.write(msgData);
                    setTimeout(()=>{
                        var MSB_Uptime 
                        var LSB_Uptime 
                        if (this.network.messagesIn.length > 0){
                           this.network.messagesIn.forEach(element => {
                                var msg = cbusLib.decode(element);
                                if (msg.nodeNumber == RetrievedValues.getNodeNumber()) {
                                    if (msg.mnemonic == "DGN"){
                                        if (msg.DiagnosticCode == 2) {
                                            MSB_Uptime = msg.DiagnosticValue
                                            winston.info({message: 'VLCB:      NNRST: ' + ' uptime MSB ' + MSB_Uptime}); 
                                        }
                                        if (msg.DiagnosticCode == 3) {
                                            LSB_Uptime = msg.DiagnosticValue
                                            winston.info({message: 'VLCB:      NNRST: ' + ' uptime LSB ' + LSB_Uptime}); 
                                        }
                                    }
                                }
                            })
                        }
                        // now check uptime if we've received both parts
                        if ((MSB_Uptime != undefined) && (LSB_Uptime != undefined)) {
                            var uptime = (MSB_Uptime << 8) + LSB_Uptime
                            winston.info({message: 'VLCB:      NNRST: ' + ' uptime after NNRST = ' + uptime}); 
                            if (uptime < 2){ this.hasTestPassed = true }
                        }
                        utils.processResult(RetrievedValues, this.hasTestPassed, 'NNRST');
                        resolve();
                        ;} , 1000
                    );
                }
                ;} , 200
            );
        }.bind(this));
    }
	
	
}

module.exports = {
    opcodes_5x: opcodes_5x
}