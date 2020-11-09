import React, { FunctionComponent, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RouteComponentProps } from "react-router";
import { usePageTitle } from "../../hooks/usePageTitle";
import { FlowTabs } from "../flow/components/FlowTabs";
import { $flow, setFlowStep } from "../flow/flowSlice";
import { FlowStep } from "../flow/flowTypes";
import { useExchangeRates } from "../marketData/marketDataHooks";
import { useTxParam } from "../transactions/transactionsUtils";
import { PaperTitleProvider } from "./mintUtils";
import { MintDepositStep } from "./steps/MintDepositStep";
import { MintFeesStep } from "./steps/MintFeesStep";
import { MintInitialStep } from "./steps/MintInitialStep";

export const MintFlow: FunctionComponent<RouteComponentProps> = () => {
  usePageTitle("Minting");
  useExchangeRates();
  const dispatch = useDispatch();
  const { tx } = useTxParam();
  const { step } = useSelector($flow);
  useEffect(() => {
    if (tx && step !== FlowStep.DEPOSIT) {
      dispatch(setFlowStep(FlowStep.DEPOSIT));
    }
  }, [dispatch, step, tx]);
  return (
    <PaperTitleProvider>
      {step === FlowStep.INITIAL && <FlowTabs />}
      {step === FlowStep.INITIAL && <MintInitialStep />}
      {step === FlowStep.FEES && <MintFeesStep />}
      {step === FlowStep.DEPOSIT && <MintDepositStep />}
    </PaperTitleProvider>
  );
};
