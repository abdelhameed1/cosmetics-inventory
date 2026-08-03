// src/plugins/inventory-dashboard/admin/src/components/WizardShell.tsx
import { type ReactNode } from 'react';
import {
  Box, Button, HStack, Step, StepIcon, StepIndicator, StepNumber, StepSeparator,
  StepStatus, StepTitle, Stepper, Text, useSteps,
} from '@chakra-ui/react';
import { useIntl } from 'react-intl';

export interface WizardStep {
  label: string;
  content: ReactNode;
  isValid: () => boolean;
}

export interface WizardShellProps {
  steps: WizardStep[];
  onSubmit: () => Promise<void>;
  submitLabel: string;
  isSubmitting: boolean;
  submitError: string | null;
}

export function WizardShell({ steps, onSubmit, submitLabel, isSubmitting, submitError }: WizardShellProps) {
  const intl = useIntl();
  const { activeStep, setActiveStep } = useSteps({ index: 0, count: steps.length });
  const isLastStep = activeStep === steps.length - 1;
  const canAdvance = steps[activeStep]?.isValid() ?? false;

  const goBack = () => setActiveStep(activeStep - 1);
  const goNext = () => setActiveStep(activeStep + 1);
  const jumpTo = (i: number) => {
    if (i < activeStep) setActiveStep(i);
  };

  return (
    <Box>
      <Stepper index={activeStep} colorScheme="brand" size="sm" mb={8}>
        {steps.map((step, i) => (
          <Step key={step.label} onClick={() => jumpTo(i)} cursor={i < activeStep ? 'pointer' : 'default'}>
            <StepIndicator>
              <StepStatus
                complete={<StepIcon />}
                incomplete={<StepNumber>{i + 1}</StepNumber>}
                active={<StepNumber>{i + 1}</StepNumber>}
              />
            </StepIndicator>
            <Box flexShrink={0} display={{ base: 'none', md: 'block' }}>
              <StepTitle>{step.label}</StepTitle>
            </Box>
            <StepSeparator />
          </Step>
        ))}
      </Stepper>

      <Box>{steps[activeStep]?.content}</Box>

      {submitError && isLastStep && (
        <Text color="severity.critical.fg" pt={4}>{submitError}</Text>
      )}

      <HStack spacing={2} pt={6}>
        {activeStep > 0 && (
          <Button variant="ghost" onClick={goBack} isDisabled={isSubmitting}>
            {intl.formatMessage({ id: 'common.back', defaultMessage: 'Back' })}
          </Button>
        )}
        {!isLastStep && (
          <Button onClick={goNext} isDisabled={!canAdvance}>
            {intl.formatMessage({ id: 'common.next', defaultMessage: 'Next' })}
          </Button>
        )}
        {isLastStep && (
          <Button onClick={onSubmit} isDisabled={!canAdvance || isSubmitting} isLoading={isSubmitting}>
            {submitLabel}
          </Button>
        )}
      </HStack>
    </Box>
  );
}
