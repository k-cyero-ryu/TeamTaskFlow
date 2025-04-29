import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type User = {
  id: number;
  username: string;
};

type UserSelectorProps = {
  id: string;
  name: string;
  value?: string;
  onChange?: (value: string) => void;
};

export function UserSelector({ id, name, value, onChange }: UserSelectorProps) {
  const [selectedValue, setSelectedValue] = useState<string>(value || '');
  
  // Fetch users from API
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      console.log('Fetching users for selector');
      try {
        const response = await fetch('/api/users', {
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Failed response when fetching users:', errorText);
          throw new Error(`Failed to fetch users: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Users loaded:', data);
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error('Error fetching users:', error);
        return [];
      }
    },
    staleTime: 60000, // Cache for 1 minute
    refetchOnMount: true,
  });

  // Update selected value when the external value changes
  useEffect(() => {
    if (value) {
      setSelectedValue(value);
    }
  }, [value]);

  // Handle selection change
  const handleValueChange = (newValue: string) => {
    setSelectedValue(newValue);
    
    // Call external onChange if provided
    if (onChange) {
      onChange(newValue);
    }
  };

  return (
    <>
      <Select 
        value={selectedValue} 
        onValueChange={handleValueChange}
        disabled={isLoading}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder="Select a user" />
        </SelectTrigger>
        <SelectContent>
          {users.map((user) => (
            <SelectItem key={user.id} value={user.id.toString()}>
              {user.username}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {/* Hidden input to submit the value with the form */}
      <input type="hidden" name={name} value={selectedValue} />
    </>
  );
}

export default UserSelector;