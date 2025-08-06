import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CaptchaChallengeProps {
  onVerify: (isValid: boolean) => void;
  className?: string;
}

export function CaptchaChallenge({ onVerify, className }: CaptchaChallengeProps) {
  const [num1, setNum1] = useState(0);
  const [num2, setNum2] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [isValid, setIsValid] = useState(false);

  const generateNumbers = () => {
    const newNum1 = Math.floor(Math.random() * 10);
    const newNum2 = Math.floor(Math.random() * 10);
    setNum1(newNum1);
    setNum2(newNum2);
    setUserAnswer('');
    setIsValid(false);
    onVerify(false);
  };

  useEffect(() => {
    generateNumbers();
  }, []);

  useEffect(() => {
    const answer = parseInt(userAnswer);
    const correctAnswer = num1 + num2;
    const valid = !isNaN(answer) && answer === correctAnswer;
    setIsValid(valid);
    onVerify(valid);
  }, [userAnswer, num1, num2, onVerify]);

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Security Check</label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={generateNumbers}
              className="h-6 w-6 p-0"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-lg font-mono bg-muted px-3 py-2 rounded">
              <span>{num1}</span>
              <span>+</span>
              <span>{num2}</span>
              <span>=</span>
            </div>
            
            <Input
              type="number"
              placeholder="?"
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              className={`w-20 text-center ${isValid ? 'border-success' : userAnswer ? 'border-destructive' : ''}`}
              min="0"
              max="18"
            />
          </div>
          
          {userAnswer && (
            <p className={`text-xs ${isValid ? 'text-success' : 'text-destructive'}`}>
              {isValid ? '✓ Correct!' : '✗ Try again'}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}