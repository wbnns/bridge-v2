import { Box, Divider, Grow, Typography } from "@material-ui/core";
import {
  depositMachine,
  DepositMachineSchema,
  GatewaySession,
  GatewayTransaction,
} from "@renproject/rentx";
import QRCode from "qrcode.react";
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { Actor } from "xstate";
import {
  ActionButton,
  BigQrCode,
  CopyContentButton,
  QrCodeIconButton,
  ToggleIconButton,
} from "../../../components/buttons/Buttons";
import { NumberFormatText } from "../../../components/formatting/NumberFormatText";
import { BitcoinIcon } from "../../../components/icons/RenIcons";
import {
  CenteringSpacedBox,
  MediumWrapper,
} from "../../../components/layout/LayoutHelpers";
import {
  PaperActions,
  PaperContent,
  PaperHeader,
  PaperNav,
  PaperTitle,
} from "../../../components/layout/Paper";
import {
  ProgressWithContent,
  ProgressWrapper,
} from "../../../components/progress/ProgressHelpers";
import { BigAssetAmount } from "../../../components/typography/TypographyHelpers";
import { Debug } from "../../../components/utils/Debug";
import { BridgeCurrency } from "../../../components/utils/types";
import { useSelectedChainWallet } from "../../../providers/multiwallet/multiwalletHooks";
import { useNotifications } from "../../../providers/Notifications";
import { orangeLight } from "../../../theme/colors";
import {
  getChainConfigByRentxName,
  getCurrencyConfigByRentxName,
  getCurrencyShortLabel,
  getNetworkConfigByRentxName,
} from "../../../utils/assetConfigs";
import { useGasPrices } from "../../marketData/marketDataHooks";
import { BookmarkPageWarning } from "../../transactions/components/TransactionsHelpers";
import { useTxParam } from "../../transactions/transactionsUtils";
import { setWalletPickerOpened } from "../../wallet/walletSlice";
import {
  DepositAcceptedStatus,
  DepositConfirmationStatus,
  DestinationPendingStatus,
  DestinationReceivedStatus,
  ProgressStatus,
} from "../components/MintStatuses";
import { $mint } from "../mintSlice";
import { useMintMachine, usePaperTitle } from "../mintUtils";
import { MintFees } from "./MintFeesStep";

export const MintDepositStep: FunctionComponent = () => {
  useGasPrices();
  const dispatch = useDispatch();
  const { status } = useSelectedChainWallet();
  const { currency } = useSelector($mint);
  const [title, setTitle] = usePaperTitle();
  useEffect(() => {
    setTitle(`Send ${getCurrencyShortLabel(currency)}`);
  }, [setTitle, currency]);
  const { tx: parsedTx, txState } = useTxParam();
  const [tx] = useState<GatewaySession>(parsedTx as GatewaySession); //TODO fix this

  const handleWalletPickerOpen = useCallback(() => {
    dispatch(setWalletPickerOpened(true));
  }, [dispatch]);

  const walletConnected = status === "connected";
  const showTransactionStatus = !!tx && walletConnected;
  return (
    <>
      <PaperHeader>
        <PaperNav />
        <PaperTitle>{title}</PaperTitle>
        <PaperActions>
          <ToggleIconButton variant="settings" />
          <ToggleIconButton variant="notifications" />
        </PaperActions>
      </PaperHeader>
      <PaperContent bottomPadding>
        {showTransactionStatus && <MintTransactionStatus tx={tx} />}
        {!walletConnected && (
          <ActionButton onClick={handleWalletPickerOpen}>
            Connect Wallet
          </ActionButton>
        )}
      </PaperContent>
      <Divider />
      <PaperContent topPadding bottomPadding>
        <MintFees />
        <Debug it={{ parsedTx, txState: txState }} />
      </PaperContent>
      {txState?.newTx && <BookmarkPageWarning />}
    </>
  );
};

type MintTransactionStatusProps = {
  tx: GatewaySession;
};

const getAddressValidityMessage = (expiryTime: number) => {
  const time = Math.ceil((expiryTime - Number(new Date())) / 1000 / 3600);
  const unit = "hours";
  return `This Gateway Address is only valid for ${time} ${unit}. Do not send multiple deposits or deposit after ${time} ${unit}.`;
};

const MintTransactionStatus: FunctionComponent<MintTransactionStatusProps> = ({
  tx,
}) => {
  const [current] = useMintMachine(tx);
  const { showNotification } = useNotifications();
  useEffect(() => {
    showNotification(getAddressValidityMessage(tx.expiryTime), {
      variant: "warning",
    });
  }, [showNotification, tx.expiryTime]);

  const activeDeposit = useMemo<{
    deposit: GatewayTransaction;
    machine: Actor<typeof depositMachine>;
  } | null>(() => {
    const deposit = Object.values(current.context.tx.transactions)[0];
    if (!deposit || !current.context.depositMachines) return null;
    const machine = current.context.depositMachines[deposit.sourceTxHash];
    return { deposit, machine };
  }, [current.context]);

  return (
    <>
      {activeDeposit ? (
        <DepositStatus
          tx={current.context.tx}
          deposit={activeDeposit.deposit}
          machine={activeDeposit.machine}
        />
      ) : (
        <DepositTo
          amount={Number(current.context.tx.suggestedAmount) / 1e8}
          currency={
            getCurrencyConfigByRentxName(current.context.tx.sourceAsset).symbol
          }
          gatewayAddress={current.context.tx.gatewayAddress}
          processingTime={60} // TODO: calculate
        />
      )}
      <Debug it={{ contextTx: current.context.tx, activeDeposit }} />
    </>
  );
};

type DepositToProps = {
  amount: number;
  currency: BridgeCurrency;
  gatewayAddress?: string;
  processingTime: number;
};

const DepositTo: FunctionComponent<DepositToProps> = ({
  amount,
  currency,
  gatewayAddress,
  processingTime,
}) => {
  const [showQr, setShowQr] = useState(false);
  const toggleQr = useCallback(() => {
    setShowQr(!showQr);
  }, [showQr]);

  return (
    <>
      <ProgressWrapper>
        <ProgressWithContent color={orangeLight} size={64}>
          <BitcoinIcon fontSize="inherit" color="inherit" />
        </ProgressWithContent>
      </ProgressWrapper>
      <MediumWrapper>
        <BigAssetAmount
          value={
            <span>
              Send <NumberFormatText value={amount} spacedSuffix={currency} />{" "}
              to
            </span>
          }
        />
      </MediumWrapper>
      {!!gatewayAddress && (
        <>
          {showQr && (
            <CenteringSpacedBox>
              <Grow in={showQr}>
                <BigQrCode>
                  <QRCode value={gatewayAddress} />
                </BigQrCode>
              </Grow>
            </CenteringSpacedBox>
          )}
          <CopyContentButton content={gatewayAddress} />
        </>
      )}
      <Box
        mt={2}
        display="flex"
        justifyContent="center"
        flexDirection="column"
        alignItems="center"
      >
        <Typography variant="caption" gutterBottom>
          Estimated processing time: {processingTime} minutes
        </Typography>
        <Box mt={2}>
          <QrCodeIconButton onClick={toggleQr} />
        </Box>
      </Box>
    </>
  );
};

type DepositStatusProps = {
  tx: GatewaySession;
  deposit: GatewayTransaction;
  machine: Actor<typeof depositMachine>;
};

export const forceState = "srcConfirmed" as keyof DepositMachineSchema["states"];

export const DepositStatus: FunctionComponent<DepositStatusProps> = ({
  tx,
  deposit,
  machine,
}) => {
  const handleSubmitToDestinationChain = useCallback(() => {
    machine?.send({ type: "CLAIM" });
  }, [machine]);

  if (!machine) {
    return <div>Transaction completed</div>;
  }
  console.log("msv", machine.state.value);
  const sourceCurrencyConfig = getCurrencyConfigByRentxName(tx.sourceAsset);
  const destinationCurrencyConfig = getCurrencyConfigByRentxName(
    tx.sourceAsset
  ); // TODO: change
  const sourceChainConfig = getChainConfigByRentxName(tx.sourceNetwork);
  const destinationChainConfig = getChainConfigByRentxName(tx.destNetwork);
  const networkConfig = getNetworkConfigByRentxName(tx.network);
  // const destinationCurrencyConfig = getCurrencyConfigByRentxName(
  //   machine.state.context.tx.destAsset
  // );
  const stateValue = machine.state
    .value as keyof DepositMachineSchema["states"];
  switch (stateValue) {
    // switch (forceState) {
    case "srcSettling":
      return (
        <>
          <DepositConfirmationStatus
            network={networkConfig.symbol}
            sourceChain={sourceChainConfig.symbol}
            currency={sourceCurrencyConfig.symbol}
            confirmations={deposit.sourceTxConfs}
            targetConfirmations={deposit.sourceTxConfTarget}
            amount={Number(deposit.sourceTxAmount) / 1e8}
            txHash={deposit.sourceTxHash}
            timeRemaining={
              Math.max(
                Number(deposit.sourceTxConfTarget) - deposit.sourceTxConfs,
                0
              ) * Number(sourceCurrencyConfig.sourceConfirmationTime) || 0
            }
          />
        </>
      );
    case "srcConfirmed": // source chain confirmations ok, but renVM still doesn't accept it
    case "claiming":
    case "accepted": // RenVM accepted it, it can be submitted to ethereum
      return (
        <DepositAcceptedStatus
          network={networkConfig.symbol}
          sourceCurrency={sourceCurrencyConfig.symbol}
          sourceAmount={deposit.sourceTxAmount / 1e8}
          sourceChain={sourceChainConfig.symbol}
          sourceTxHash={deposit.sourceTxHash}
          sourceConfirmations={deposit.sourceTxConfs}
          sourceConfirmationsTarget={deposit.sourceTxConfTarget} // TODO: resolve
          destinationChain={destinationChainConfig.symbol}
          onSubmit={handleSubmitToDestinationChain}
          submitting={stateValue === "claiming"}
        />
      );
    case "destInitiated": // final txHash means its done or check if wallet balances went up
      if (deposit.destTxHash) {
        return (
          <DestinationReceivedStatus
            network={networkConfig.symbol}
            sourceCurrency={sourceCurrencyConfig.symbol}
            sourceChain={sourceChainConfig.symbol}
            sourceTxHash={deposit.sourceTxHash}
            destinationCurrency={destinationCurrencyConfig.symbol}
            destinationChain={destinationChainConfig.symbol}
            destinationTxHash={deposit.destTxHash || ""}
            destinationAmount={Number(tx.targetAmount)}
          />
        );
      } else {
        return (
          <DestinationPendingStatus
            network={networkConfig.symbol}
            sourceCurrency={sourceCurrencyConfig.symbol}
            sourceAmount={deposit.sourceTxAmount / 1e8}
            sourceChain={sourceChainConfig.symbol}
            sourceTxHash={deposit.sourceTxHash}
            destinationChain={destinationChainConfig.symbol}
            onSubmit={handleSubmitToDestinationChain}
            submitting={true}
            destinationTxHash={deposit.destTxHash || ""}
          />
        );
      }

    case "restoringDeposit":
      return <ProgressStatus reason="Restoring..." />;
    default:
      return <ProgressStatus reason={machine.state.value} />;
  }
};
