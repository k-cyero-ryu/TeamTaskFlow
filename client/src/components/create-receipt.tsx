import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

const createReceiptSchema = z.object({
	receipt_code: z.string().min(1, "Receipt Code is required"),
	responsible_name: z.string().min(1, "Responsible name is required"),
	for_name: z.string().min(1, "Receiver name is required"),
	items: z
		.array(
			z.object({
				item_id: z.number({ required_error: "Item is required" }),
				quantity: z.number().min(1, "Quantity must be at least 1"),
			})
		)
		.min(1, "Select at least one item"),
});

type CreateReceiptForm = z.infer<typeof createReceiptSchema>;

interface Props {
	stockItems: { id: number; name: string }[];
	onClose: () => void;
	onSubmit: (data: CreateReceiptForm) => void;
}

//Receipt Code generator
	const date = 	new Date();

	const receiptCode = `STCK_${String(date.getDate()).padStart(2, "0")}${String(date.getSeconds()).padStart(2, "0")}${String(date.getMilliseconds()).padStart(6, "0")}`;


export function ReceiptForm({ stockItems, onClose, onSubmit }: Props) {
	const form = useForm<CreateReceiptForm>({
		resolver: zodResolver(createReceiptSchema),
		defaultValues: {
			receipt_code: receiptCode,
			responsible_name: "",
			for_name: "",
			items: [{ item_id: stockItems[0]?.id || 0, quantity: 1 }],
		},
	});

	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: "items",
	});




	return (
		<DialogContent className="max-w-lg">
			<DialogHeader>
				<DialogTitle>Create Receipt</DialogTitle>
				<DialogDescription>
					Select items and quantities to create a receipt.
				</DialogDescription>
			</DialogHeader>

			<Form {...form}>
				<form
					onSubmit={form.handleSubmit(onSubmit)}
					className="space-y-4"
				>
					{/* Receipt Info */}
					<FormField
						control={form.control}
						name="receipt_code"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Receipt Code *</FormLabel>
								<FormControl>
									<Input readOnly placeholder="Enter receipt code" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="responsible_name"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Responsible Name *</FormLabel>
								<FormControl>
									<Input placeholder="Who is responsible?" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="for_name"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Receiver Name *</FormLabel>
								<FormControl>
									<Input placeholder="Who is it for?" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					{/* Dynamic Items */}
					<div className="space-y-2">
						{fields.map((field, index) => (
							<div key={field.id} className="grid grid-cols-3 gap-2 items-end">
								<FormField
									control={form.control}
									name={`items.${index}.item_id`}
									render={({ field: selectField }) => (
										<FormItem>
											<FormLabel>Item *</FormLabel>
											<FormControl>
												<Select
													value={selectField.value.toString()}
													onValueChange={(val) =>
														selectField.onChange(parseInt(val))
													}
												>
													<SelectTrigger>
														<SelectValue placeholder="Select item" />
													</SelectTrigger>
													<SelectContent>
														{stockItems.map((item) => (
															<SelectItem
																key={item.id}
																value={item.id.toString()}
															>
																{item.name}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name={`items.${index}.quantity`}
									render={({ field: qtyField }) => (
										<FormItem>
											<FormLabel>Quantity *</FormLabel>
											<FormControl>
												<Input
													type="number"
													min={1}
													{...qtyField}
													onChange={(e) =>
														qtyField.onChange(parseInt(e.target.value) || 1)
													}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<Button
									type="button"
									variant="destructive"
									onClick={() => remove(index)}
									className="h-10"
								>
									Remove
								</Button>
							</div>
						))}
					</div>

					<Button
						type="button"
						onClick={() => append({ item_id: stockItems[0]?.id || 0, quantity: 1 })}
						className="mt-2"
					>
						Add Item
					</Button>

					{/* Submit */}
					<div className="flex justify-end gap-2 mt-4">
						<Button type="button" variant="outline" onClick={onClose}>
							Cancel
						</Button>
						<Button type="submit">Create Receipt</Button>
					</div>
				</form>
			</Form>
		</DialogContent>
	);
}
