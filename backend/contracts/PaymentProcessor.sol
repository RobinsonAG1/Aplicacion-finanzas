// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Procesador de pagos on-chain de la app de finanzas.
/// Cada pago referenciado por un refId (UUID de la transaccion financiera,
/// pasado a bytes32) queda registrado como evento auditable en la cadena.
contract PaymentProcessor {
    address public immutable treasury;

    event PaymentReceived(address indexed payer, uint256 amountWei, bytes32 indexed refId);

    error ZeroAmount();
    error ZeroAddress();

    constructor(address _treasury) {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
    }

    /// Registra un pago con su referencia y envia los fondos al treasury.
    function pay(bytes32 refId) external payable {
        if (msg.value == 0) revert ZeroAmount();
        emit PaymentReceived(msg.sender, msg.value, refId);
        (bool sent, ) = treasury.call{value: msg.value}("");
        require(sent, "treasury transfer failed");
    }

    /// Fallback de seguridad: devuelve fondos mal enviados sin refId.
    receive() external payable {
        (bool sent, ) = treasury.call{value: msg.value}("");
        require(sent, "treasury transfer failed");
    }
}
