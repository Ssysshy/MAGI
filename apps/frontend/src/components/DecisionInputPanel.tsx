import { Button, Text, Textarea, View } from '@tarojs/components';
import './DecisionInputPanel.less';

export interface DecisionInputPanelProps {
  question: string;
  questionTypeLabel: string;
  loading: boolean;
  onQuestionChange: (value: string) => void;
  onSubmit: () => void;
}

interface TextareaValueEvent {
  detail: {
    value: string;
  };
}

export const DecisionInputPanel = ({
  question,
  questionTypeLabel,
  loading,
  onQuestionChange,
  onSubmit,
}: DecisionInputPanelProps): JSX.Element => (
  <View className="decision-input">
    <Textarea
      className="question-textarea"
      value={question}
      maxlength={2000}
      disabled={loading}
      onInput={(event: TextareaValueEvent): void => onQuestionChange(event.detail.value)}
    />
    <View className="decision-actions">
      <Button className="thin-button" disabled={loading}>
        <Text>{loading ? '◐' : questionTypeLabel}</Text>
      </Button>
      <Button className="thin-button submit-button" disabled={loading} onClick={onSubmit}>
        <Text>{loading ? 'ANALYZING' : '➤'}</Text>
      </Button>
    </View>
  </View>
);
